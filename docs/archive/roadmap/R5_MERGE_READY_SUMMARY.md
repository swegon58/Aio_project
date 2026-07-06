# R5 Merge-Ready Summary

**Branch:** `feat/r5-r7-delivery-line`
**Worktree:** `/home/swegon/AI_Agent/Aio_project`
**Status:** Verification-complete, awaiting product-owner merge approval
**Updated:** 2026-06-29

This note is the shortest path for any follow-up agent or reviewer.

## What R5 Delivered

R5 removes long-running scheduled work from request lifetimes and moves it onto
an Aio-owned durable queue/worker contract.

Delivered scope:

- ADR-owned queue/worker baseline and scheduled-task runtime policy
- versioned durable job contract and queue state machine
- durable `aio_jobs`, `aio_schedules`, and `aio_schedule_runs` schema
- repository/runtime layer for queue claim, retry, lease recovery, schedule
  CRUD/history, due-schedule enqueue, and scheduled-task execution
- `aio-job-worker` service added to the local always-on Aio stack
- `/api/cron` moved from Hermes-local scheduling to Aio-owned schedule storage
- R5.5 failure/recovery protections:
  - at-most-once guard for unbound `running` schedule runs
  - queued-job cancel propagation on schedule pause/delete
  - dead-letter/retry boundaries aligned with scheduled-task semantics
- R5.6 unit coverage for duplicate enqueue, lease recovery, retry exhaustion,
  exactly-once behavior, and cancel propagation

## Key Product Outcome

Scheduled work is now owned by Aio durability surfaces rather than transient
request handlers or Hermes-local cron state. Due occurrences become durable
`scheduled_task` jobs, the worker sweeps and dispatches them, and schedule
history is preserved in Aio tables.

## Verification Evidence

Completed and green on the active branch:

- `npm run typecheck`
- `npm run test:unit` (`155/155`)
- `AIO_DEPLOYMENT_ENV=development npm run build`
- targeted `npx eslint` on the changed merge-prep files
- live/local probes:
  - `apps/web/scripts/r5-3-job-queue-probe.ts`
  - `apps/web/scripts/r5-4-schedule-repo-probe.ts`
  - `apps/web/scripts/r5-4-schedule-enqueue-probe.ts`
  - `apps/web/scripts/r5-4-schedule-worker-probe.ts`
  - `apps/web/scripts/r5-5-atmostonce-probe.ts`
  - `apps/web/scripts/r5-5-cancel-propagation-probe.ts`

## Caveat

The full live execute end-to-end for scheduled-task execution remains gated on a
provisioned dev-user Hermes registry row. The enqueue path, execution preamble,
queue recovery, and failure/cancel paths are verified locally; the remaining
gate is explicitly documented and should not be overstated as complete.

## Files Most Relevant To Review

- `docs/architecture/ADR-004-queue-and-worker-runtime.md`
- `docs/architecture/ADR-005-scheduled-task-runtime-and-history.md`
- `apps/web/src/lib/aio/jobs/`
- `apps/web/src/lib/aio/schedules/`
- `apps/web/src/app/api/cron/`
- `apps/web/scripts/aio-job-worker.ts`
- `apps/web/scripts/r5-*.ts`
- `apps/web/supabase/migrations/0017_aio_jobs.sql`
- `apps/web/supabase/migrations/0018_aio_schedules.sql`
- `apps/web/supabase/migrations/0019_aio_schedule_run_links.sql`
- `docs/roadmap/R5_EXECUTION_CHECKLIST.md`

## Recommended Next Action

If the product owner approves, review the branch as the complete R5 delivery
stack and merge it into `main`. Do not begin R6 implementation until the owner
explicitly approves R6 on this delivery line.
