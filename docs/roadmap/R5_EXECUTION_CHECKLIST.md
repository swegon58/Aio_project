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
  - scheduled task APIs still proxy Hermes via `apps/web/src/app/api/cron/`
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

- [~] Move scheduled tasks onto Aio-owned durable scheduling/history
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

Continue `R5.4`: wire due-schedule claim/enqueue worker paths and migrate
`/api/cron` from Hermes proxying onto the new Aio-owned schedule tables.
