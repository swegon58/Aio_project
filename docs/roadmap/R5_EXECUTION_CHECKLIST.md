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

- [x] Define dead-letter, retry caps, duplicate-delivery protection, and cancel propagation
  - [x] At-most-once guard in `executeScheduledTaskJob`: detects unbound `status=running` run on re-delivery → dead-letters via `SCHEDULED_RUN_UNBOUND_CRASH` (schedule-runtime.ts:394)
  - [x] Cancel propagation: `cancelQueuedJobsForSchedule` in job-repository.ts wired to `deleteSchedule` and `pauseSchedule` in schedule-repository.ts — queued jobs cancelled atomically
  - [x] Probes: `scripts/r5-5-atmostonce-probe.ts`, `scripts/r5-5-cancel-propagation-probe.ts`

### R5.6 Tests

- [x] Duplicate enqueue coverage
  - [x] `schedule-runtime.test.ts`: duplicate `createScheduleRun` is a no-op and does not create a second durable job
- [x] Worker crash / lease recovery coverage
  - [x] `aio-job-worker-runtime.test.ts`: stale leased jobs are requeued through the worker sweep with the configured recovery delay
- [x] Retry exhaustion coverage
  - [x] `aio-job-worker-runtime.test.ts`: final-attempt execution failure dead-letters instead of retrying
- [x] Scheduled occurrence exactly-once coverage
  - [x] `schedule-runtime.test.ts`: completed bound runs sync/return without re-orchestrating; unbound `running` runs fail closed with `SCHEDULED_RUN_UNBOUND_CRASH`
- [x] Cancellation / duplicate billing-action protection coverage
  - [x] Duplicate billing-action protection covered by the scheduled occurrence exactly-once tests above
  - [x] `schedule-repository.test.ts`: pause/delete cancellation propagation runs before the schedule mutation, and remains best-effort when internal cancel attempts fail

## Exact Next Step

R5 test coverage is complete on the active delivery branch. Hold R6 until the
product owner explicitly approves it; the immediate branch work is review /
merge preparation for the completed R5 stack.
