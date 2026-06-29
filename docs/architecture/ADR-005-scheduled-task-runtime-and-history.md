# ADR-005: Scheduled Task Runtime And History

**Status:** Accepted (R5.4 baseline)
**Date:** 2026-06-29
**Phase:** R5 — Background Workers And Scheduled Work

## Context

R5.3 established an Aio-owned durable queue contract, worker loop, and lease
recovery path, but scheduled tasks still live behind Hermes-local storage and
proxy routes:

- `apps/web/src/app/api/cron/route.ts` and
  `apps/web/src/app/api/cron/[jobId]/route.ts` forward schedule CRUD and run
  commands to a per-customer Hermes gateway.
- `apps/harness/hermes-agent/cron/jobs.py` stores schedule definitions in
  `~/.hermes/cron/jobs.json`, computes `next_run_at`, and tracks run history in
  local runtime files.
- Hermes' current file-backed scheduler is useful for a single runtime, but it
  is not durable product state that Aio can audit, replay, meter, or reconcile
  across web restarts and worker crashes.

R5.4 needs one product-owned answer for three questions:

1. Where do schedule definitions live?
2. How are missed occurrences handled after downtime or lease loss?
3. What happens if one schedule fires while its previous run is still active?

## Decision

Use **Aio-owned schedule definitions and schedule-run history in Postgres**,
with the R5 queue producing concrete `scheduled_task` jobs and Hermes remaining
only the execution adapter for the work inside those jobs.

Concretely:

1. Aio will store each schedule definition, next due time, and schedule status
   in Postgres.
2. Aio will record each produced occurrence in a durable schedule-run ledger
   before or while enqueuing the corresponding `scheduled_task` job.
3. Queue workers, not Hermes-local cron files, will be responsible for
   claiming due schedules and enqueuing job executions.
4. Hermes may still execute the scheduled task payload, but it will no longer
   own the canonical schedule registry or history.

## Policy Decisions

### Missed-run policy

- **One-shot schedules:** if the due time passes while Aio is offline, enqueue
  the occurrence once on recovery unless the schedule was cancelled.
- **Recurring schedules (interval/cron):** coalesce backlog into **one catch-up
  occurrence at recovery time**, then advance `next_run_at` to the next future
  occurrence. Do not fan out a long outage into N queued historical runs.
- Record whether an occurrence was on-time, catch-up, skipped, or cancelled in
  the durable schedule-run history.

Why: Aio is a consumer product, and backlog storms are more harmful than
helpful. Users need a trustworthy "you missed one run and Aio caught up" trail,
not hundreds of stale queued jobs after a laptop or worker was offline.

### Concurrency policy

- Default policy for scheduled tasks is **no overlap**.
- If a schedule becomes due while its prior run is still non-terminal, Aio does
  **not** start a second concurrent execution for that same schedule.
- Instead, Aio records the attempted occurrence as an overlap event in durable
  history and advances the schedule according to the missed-run policy above.

Why: overlapping consumer automations are a high-risk source of duplicate
messages, duplicate billing-affecting actions, and confusing user-visible
results. "Skip overlap, record it, and continue" is safer than surprise
parallelism.

### Source-of-truth policy

- Hermes-local `jobs.json` and output files become compatibility artifacts only.
- Product APIs/UI should read schedule state and run history from Aio-owned
  tables.
- Hermes cron REST proxy routes are transition surfaces, not the durable design
  target.

## Options Considered

### Option A: Keep Hermes as the canonical scheduler

Pros:

- no new schedule tables required
- reuses existing file-backed scheduler logic immediately

Cons:

- schedule truth remains outside Aio's durable product data model
- no strong tenant-scoped history or queue correlation in Postgres
- overlap, retries, and missed-run behavior remain runtime-local instead of
  product-auditable

Decision: rejected

### Option B: Aio-owned schedule registry plus queue-produced occurrences

Pros:

- matches the R5 queue ADR and durable job contract
- gives Aio a first-class schedule history for UI, billing, audits, and future
  notifications
- keeps Hermes in the execution-plane role already established elsewhere

Cons:

- Aio must implement schedule claim/recompute logic itself
- Hermes compatibility routes must be migrated or shimmed during transition

Decision: **chosen**

## Consequences

### Positive

- Schedule state survives web restarts, worker restarts, and runtime migration.
- Missed runs and overlap decisions become explicit product behavior instead of
  hidden scheduler side effects.
- Scheduled work can share the same queue, correlation, and audit patterns as
  other R5 jobs.

### Negative

- R5.4 must add recurrence computation, durable occurrence records, and
  schedule claim logic in Aio.
- Some Hermes schedule APIs will become migration shims until the UI reads from
  Aio-owned schedule tables directly.

## Implementation Direction

R5.4 should proceed in this order:

1. Add schedule-definition and schedule-run tables in Postgres.
2. Add repository helpers for create/list/update/pause/resume/cancel and
   exactly-once occurrence recording.
3. Add a worker path that claims due schedules and enqueues `scheduled_task`
   jobs through the R5 queue.
4. Move `/api/cron` routes from Hermes proxying toward Aio-owned persistence,
   keeping Hermes only as the downstream execution plane.

## Guardrails

- Do not reintroduce Hermes-local files as the product source of truth.
- Do not allow overlapping executions for the same schedule by default.
- Do not fan out prolonged downtime into unbounded recurring backlog.
- Every scheduled occurrence must map to durable history and, when enqueued, to
  an Aio job idempotency boundary.
