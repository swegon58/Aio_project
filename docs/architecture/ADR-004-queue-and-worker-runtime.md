# ADR-004: Queue And Worker Runtime

**Status:** Accepted (R5.1)  
**Date:** 2026-06-29  
**Phase:** R5 — Background Workers And Scheduled Work

## Context

Aio now has durable runs, tool governance, observability, and research/knowledge
surfaces on `main`, but long-running execution still leans on request lifetime
or in-process Hermes schedulers:

- `apps/web/src/app/api/knowledge/route.ts` still performs upload-side work in
  the request path.
- `apps/web/src/app/api/cron/route.ts` and
  `apps/web/src/app/api/cron/[jobId]/route.ts` proxy Hermes scheduling instead
  of using an Aio-owned durable job contract.
- `apps/harness/hermes-agent/cron/jobs.py` persists scheduled jobs in Hermes
  runtime storage with local file locking, which is useful for a single runtime
  but is not the Aio product source of truth.
- `apps/web/src/lib/hermes/provision.ts` and
  `apps/web/src/lib/hermes/lifecycle.ts` already manage background gateway
  processes, crash reconciliation, and idle cleanup, so R5 should extend the
  existing split of Aio control plane + Hermes execution plane rather than
  inventing a second orchestration model.

R5 needs one durable queue/runtime contract that can:

- outlive web requests
- support retries, leasing, delayed work, and cancellation
- keep tenant ownership and run correlation in Postgres
- work for both TypeScript-side orchestration and Python/Hermes execution
- avoid introducing paid infrastructure without explicit owner approval

## Decision

Use an **Aio-owned Postgres-backed queue contract** as the system of record for
R5, with workers launched as separate long-running processes and Hermes treated
as an execution adapter rather than the queue authority.

Concretely:

1. Aio will introduce durable job tables in Postgres for queue state,
   scheduling, attempts, leasing, and correlation metadata.
2. The canonical queue state machine will live in Aio docs/code, not in Hermes
   local cron storage.
3. TypeScript workers will own queue claiming, retries, expiry, and scheduled
   occurrence production.
4. Hermes workers or Hermes-triggered tasks will consume jobs through Aio-owned
   job envelopes and emit back into Aio run/job state.
5. Existing Hermes cron/file-backed scheduling remains legacy runtime behavior
   to be phased behind the new contract, not expanded as the primary product
   queue.

## Options Considered

### Option A: Postgres-backed queue on existing Aio/Supabase storage

Pros:

- reuses the product source of truth already chosen for runs, approvals, audit,
  research, and knowledge
- no new paid infra or new always-on broker is required
- easiest path to tenant-safe RLS-aware metadata ownership
- strongest fit for exact-once-ish orchestration with idempotency keys,
  leases, and append-only audit trails
- easiest to reason about from the current Aio architecture, where the web app
  already owns durable lifecycle state

Cons:

- requires careful claim/lease SQL and contention handling
- may need later scale tuning if job throughput becomes high
- Python workers should consume via Aio contracts instead of a native broker

Decision: **chosen**

### Option B: Redis + BullMQ

Pros:

- mature queue semantics for retries, delayed jobs, and worker ergonomics
- great TypeScript ecosystem

Cons:

- adds a new stateful dependency that Aio does not currently own
- weaker fit for Python/Hermes interoperability unless we add another adapter
- job truth would live partly outside Postgres unless we duplicate state
- could pull the product toward infra complexity before private-beta evidence

Decision: rejected for R5 baseline

### Option C: Managed external queue

Pros:

- offloads broker operations
- can be attractive later if workload/scale justifies it

Cons:

- violates the current no-new-paid-infra-without-explicit-approval constraint
- adds vendor lock-in before R5 establishes the product contract
- raises local-dev and cross-language complexity immediately

Decision: deferred until post-R5 evidence

## Consequences

### Positive

- Aio keeps queue truth in the same durable store as runs, approvals, audit,
  research, and knowledge.
- Scheduled tasks can move from Hermes-local persistence to Aio-owned product
  history without inventing a second data authority.
- Job retries, cancellation, and dead-letter paths can be audited with the same
  correlation context introduced in R3.
- The design stays compatible with future worker split-outs because the durable
  contract is in Postgres, not in a single in-process scheduler.

### Negative

- R5 must implement robust claim/lease behavior itself instead of inheriting a
  broker.
- Hermes cron endpoints/routes become migration targets and compatibility
  surfaces during the transition.
- Some higher-throughput workloads may eventually justify a dedicated broker,
  at which point this ADR will need a measured revisit.

## Implementation Direction

R5 should proceed in this order:

1. `R5.2` define the versioned job envelope and state machine in Aio.
2. Add durable queue tables + repositories in Postgres.
3. Add worker processes that claim leases from the queue tables.
4. Migrate knowledge ingestion, research continuation, and scheduled tasks onto
   the new contract.
5. Keep Hermes as the execution plane for runtime work, but not the queue
   source of truth.

## Guardrails

- Do not introduce Redis, SQS, or any paid queue provider in R5 without
  explicit owner approval.
- Do not let browser cookies or client state become worker dependencies.
- Do not make Hermes-local cron/job files the canonical product history.
- Every job must carry tenant/run correlation and an idempotency key.
