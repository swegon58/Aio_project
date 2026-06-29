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
- The latest integrated product stack on `main` is commit `a0c126c`
  (`ops: keep local Aio stack online via systemd`), layered on top of the
  merged R2-R4 product stack on 2026-06-29.
- Main now contains the merged R2-R4 implementation stack:
  - R2 tool manifest/policy, durable tool calls, durable approvals, approval UI,
    and audit-log groundwork
  - R3 correlation context, telemetry helpers, internal metrics surface, SLO
    document, golden fixtures, and runbooks
  - R4 research-stage durability helpers, knowledge ingestion pipeline/docs
    APIs, knowledge center panel, and research progress UI
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
- The active R5 delivery branch `feat/r5-r7-delivery-line` has now completed
  the R5.3 durable queue/worker foundation locally:
  - `aio_jobs` table plus claim/retry/lease-recovery RPC helpers
  - Aio job repository and worker poll loop
  - `aio-job-worker.service` added to the local always-on stack on this branch
  - local queue probe verified create -> claim -> running -> complete, retry
    release, and stale-lease requeue paths
- R5.4 is now in progress on `feat/r5-r7-delivery-line` with the first durable
  scheduling foundation landed locally:
  - `aio_schedules` and `aio_schedule_runs` migrations
  - TypeScript schedule parser/next-run helpers for one-shot, interval, and
    cron schedules
  - Aio schedule repository layer for durable schedule CRUD/history wiring
  - local schedule probe verified create/list/pause/resume/update/delete and
    duplicate-occurrence rejection against the local Supabase stack
  - `/api/cron` now reads and mutates Aio-owned schedule rows instead of
    proxying Hermes-local cron storage
- The next planned delivery phase is R5 (Background Workers And Scheduled Work)
  from the current `main` baseline, with R5.4 scheduled next on the active
  delivery branch.
- Product-owner approval is now active for R5 on branch
  `feat/r5-r7-delivery-line`.
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

R5 is now approved. The active execution path is:

- continue R5 on `feat/r5-r7-delivery-line`
- keep R6 and R7 on the same branch unless the owner explicitly changes that
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
