# Aio Project State

**Canonical repository:** `/home/swegon/AI_Agent/Aio_project`  
**Canonical branch:** `main`  
**Current main status:** run `scripts/aio-context.sh` for the exact live HEAD
**Most recent verified CI before this state update:** GitHub Actions run `28318122604`, all jobs passed
**Updated:** 2026-06-29

This is the first file an agent reads to learn current location and progress.
It is a status index, not a replacement for the master plan or phase checklist.

## Current Status

- R0 is formally closed on `main`.
- R1 is formally merged on `main`.
- R5 is formally merged on `main`.
- The latest integrated product stack on `main` is commit `b0589ac`
  (`merge: integrate R5 durable background workers and scheduling`), layered
  on top of the merged R2-R4 product stack on 2026-06-29.
- Main now contains the merged R2-R5 implementation stack:
  - R2 tool manifest/policy, durable tool calls, durable approvals, approval UI,
    and audit-log groundwork
  - R3 correlation context, telemetry helpers, internal metrics surface, SLO
    document, golden fixtures, and runbooks
  - R4 research-stage durability helpers, knowledge ingestion pipeline/docs
    APIs, knowledge center panel, and research progress UI
  - R5 durable job contract, worker runtime, Aio-owned schedules/history,
    scheduled-task execution path, and verified failure/recovery coverage
- The most recent local verification before this update passed:
  - `npm run typecheck`
  - `npm run test:unit`
  - `AIO_DEPLOYMENT_ENV=development npm run build`
- Current local service status from the latest `scripts/aio-context.sh` run:
  - Web: `200`
  - Hermes: `200`
  - LM Studio: `200`
- The local always-on stack is now managed by user services plus one helper
  command:
  - `scripts/aio-online.sh install|start|restart|status|logs|stop`
  - `aio-hermes.service`
  - `aio-hermes-supervisor.service`
  - `aio-app.service`
- R5 mainline verification after merge passed:
  - `npm run typecheck`
  - `npm run test:unit`
  - `AIO_DEPLOYMENT_ENV=development npm run build`
- R5 merged outcomes now on `main`:
  - `aio_jobs` table plus claim/retry/lease-recovery RPC helpers
  - `aio_schedules` / `aio_schedule_runs` durable schedule storage and history
  - `/api/cron` now reads and mutates Aio-owned schedule rows instead of
    proxying Hermes-local cron storage
  - `enqueueDueSchedules` and `executeScheduledTaskJob` now turn due schedules
    into durable `scheduled_task` jobs and drive the orchestrator
  - `aio-job-worker.service` is part of the local always-on stack
  - at-most-once guard and cancel propagation are implemented and covered by
    probes/unit tests
- Remaining R5 caveat after merge:
  - full live scheduled-task execute E2E remains gated on a provisioned
    dev-user Hermes registry row; enqueue path, execution preamble, queue
    recovery, and failure/cancel paths are verified locally
- No later phase is approved yet. Do not begin R6 until the product owner
  explicitly approves it.
- Product-owner branch policy override: keep R5, R6, and R7 on the same
  delivery branch unless the owner explicitly asks to split again.
- Historical secret-scan triage is closed for Aio R0.
- Owner decision: do not rewrite Git history for the deleted historical
  `.mcp.json` files as part of R0. Keep current-tree protection, CI scanning,
  and documentation as the repository closure boundary.
- Do not treat this repository note as proof of external credential revocation.
  Secret lifecycle remains outside the repo and must never be handled by
  exposing values in chat or commits.
- Owner preference: keep the active product line consolidated on `main` after
  the R4 integration. Do not recreate phase-specific implementation worktrees
  unless the owner explicitly asks for them.

## Worktree Roles

- `/home/swegon/AI_Agent/Aio_project`
  - Canonical product repository.
  - Use for `main`, integration, verification, and running Aio.
  - Use `scripts/aio-online.sh status` to confirm the local always-on stack.
- `/home/swegon/AI_Agent/Aio_project_onyx_openmanus_lab`
  - Research-only worktree for Onyx/OpenManus.
  - Keep it isolated from product implementation.

## Required Reading Order

1. `AIO_PROJECT_STATE.md`
2. `AIO_MASTER_EXECUTION_PLAN.md`
3. Current phase checklist under `docs/roadmap/`
4. `AGENTS.md`
5. `README.md`

## Meaning Of "Continue Building Aio"

When the product owner says "continue building Aio":

1. Run `scripts/aio-context.sh`.
2. Confirm the canonical repo, branch, local/remote commit, dirty state, CI, and
   service status.
3. Read this state file and the current phase checklist.
4. If a phase is already merged, do not keep coding in its old worktree.
5. If an approved task is marked in progress, continue that exact task.
6. If no task is approved, do not start coding. Present the next decision gate
   with concise A/B/C options and mark the recommended option.
7. After approval, create a dedicated branch/worktree from current
   `origin/main`; never implement a feature in the research worktree.
8. Implement, test, review, push, and put Aio online.
9. Update this file and the phase checklist after merge.

## Next Decision Gate

R5 is now merged on `main`. The next gated execution path is:

- do not begin R6 until the product owner explicitly approves it
- if R6 is approved, keep R6 and R7 on the same delivery branch unless the
  owner explicitly changes that
- keep any new implementation out of the research worktree

## Update Contract

The integrating agent must update this file whenever:

- a phase or feature is approved
- a new implementation worktree is created
- a task becomes blocked
- a branch is merged
- CI status materially changes
- canonical paths or runtime commands change

Do not record secrets, raw provider responses, personal prompt content, or
uncommitted runtime-state details here.
