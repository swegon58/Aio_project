# R5 Execution Checklist

Goal: remove long-running work from request lifetimes and make scheduled work
durable, observable, and recoverable.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Current State

- `main` now contains the merged R2-R4 baseline.
- Product-owner approval is active for R5.
- Active delivery branch: `feat/r5-r7-delivery-line`
- Branch policy override for this stage: keep R5, R6, and R7 on the same
  delivery branch unless the owner explicitly asks to split again.
- Local always-on stack is available through `scripts/aio-online.sh`.
- Current runtime anchors:
  - knowledge ingestion still begins in `apps/web/src/app/api/knowledge/route.ts`
  - scheduled task APIs persist schedule CRUD in Aio via `apps/web/src/app/api/cron/`;
    due schedules are now turned into durable `scheduled_task` jobs by the Aio
    queue worker (`apps/web/scripts/aio-job-worker.ts`) via
    `enqueueDueSchedules`/`executeScheduledTaskJob` in
    `apps/web/src/lib/aio/schedules/schedule-runtime.ts`
  - Hermes scheduler/runtime logic currently lives in
    `apps/harness/hermes-agent/cron/`

## R5 Checklist

### R5.1 Queue ADR

- [x] Compare Postgres-backed queue, Redis/BullMQ, and managed queue options
- [x] Lock the R5 baseline on an Aio-owned Postgres-backed queue contract
- [x] Record the decision in `docs/architecture/ADR-004-queue-and-worker-runtime.md`

### R5.2 Job Contract

- [x] Define the versioned job envelope and state machine
- [x] Lock required correlation, idempotency, attempts, schedule, and deadline fields

### R5.3 Worker Services

- [x] Add worker entrypoints/services for queue claim and execution
- [x] Define heartbeat, lease, graceful shutdown, and retry behavior

### R5.4 Scheduled Tasks

- [x] Move scheduled tasks onto Aio-owned durable scheduling/history
  - [x] `enqueueDueSchedules` turns a due schedule into a durable `scheduled_task` job bound to a queued schedule run, with catch-up / overlap-skip / missed-window policy and no double-fire (verified live via `r5-4-schedule-enqueue-probe`)
  - [x] `executeScheduledTaskJob` re-derives the run, resolves the Hermes background context, drives the orchestrator, and binds + syncs the resulting `aio_run` (execute preamble verified live via `r5-4-schedule-worker-probe`; full live execute-E2E is gated on a provisioned dev-user Hermes registry row)
  - [x] `aio-job-worker` is self-contained: each sweep calls `enqueueDueSchedules` and dispatches `scheduled_task` jobs
  - [x] migration `0019_aio_schedule_run_links` links `aio_schedule_runs.aio_run_id` to `aio_runs`
- [x] Define missed-run and concurrency policy

### R5.5 Failure And Recovery

- [ ] Define dead-letter, retry caps, duplicate-delivery protection, and cancel propagation

### R5.6 Tests

- [ ] Duplicate enqueue coverage
- [ ] Worker crash / lease recovery coverage
- [ ] Retry exhaustion coverage
- [ ] Scheduled occurrence exactly-once coverage
- [ ] Cancellation / duplicate billing-action protection coverage

## Exact Next Step

R5.4 durable scheduling wiring is complete and verified: the enqueue path is
live green and the execute handler's preamble is live green. The only remaining
R5.4 verification — a full live execute-E2E through the Hermes orchestrator —
is owner-gated on provisioning a Hermes registry row for the dev user
(`00000000-0000-0000-0000-000000000001`); once provisioned, re-run
`scripts/r5-4-schedule-worker-probe.ts` to confirm the bound `aio_run`
completes.

Proceed to `R5.5` (Failure And Recovery): define dead-letter, retry caps,
duplicate-delivery protection, and cancel propagation for the durable job
lifecycle.
