# Aio Project State

**Canonical repository:** `/home/swegon/AI_Agent/Aio_project`  
**Canonical branch:** `main`  
**Current main status:** run `scripts/aio-context.sh` for the exact live HEAD
**Most recent verified CI before this state update:** GitHub Actions run `28318122604`, all jobs passed
**Updated:** 2026-06-30

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
- R5.4 durable scheduling wiring is complete on `feat/r5-r7-delivery-line`
  (full live execute-E2E still owner-gated on a dev-user Hermes registry row):
  - `aio_schedules` and `aio_schedule_runs` migrations
  - TypeScript schedule parser/next-run helpers for one-shot, interval, and
    cron schedules
  - Aio schedule repository layer for durable schedule CRUD/history wiring
  - local schedule probe verified create/list/pause/resume/update/delete and
    duplicate-occurrence rejection against the local Supabase stack
  - `/api/cron` now reads and mutates Aio-owned schedule rows instead of
    proxying Hermes-local cron storage
  - due-schedule enqueue + execute wiring landed: `enqueueDueSchedules` and
    `executeScheduledTaskJob` in `apps/web/src/lib/aio/schedules/schedule-runtime.ts`
    turn due schedules into durable `scheduled_task` jobs and drive the
    orchestrator; `aio-job-worker` sweeps and dispatches them; migration
    `0019_aio_schedule_run_links` links runs to `aio_runs`
  - enqueue path verified live (`r5-4-schedule-enqueue-probe` green) and execute
    preamble verified live (`r5-4-schedule-worker-probe` green to the Hermes
    boundary); full live execute-E2E is gated on a provisioned dev-user Hermes
    registry row
- R5.5 failure/recovery is complete on `feat/r5-r7-delivery-line`:
  - at-most-once guard fails closed on unbound `running` schedule runs with
    `SCHEDULED_RUN_UNBOUND_CRASH`
  - delete/pause cancel propagation drops queued scheduled-task jobs best-effort
    before the schedule mutation continues
  - live probes cover the unbound-crash and cancel-propagation paths
- R5.6 test coverage is now complete locally on `feat/r5-r7-delivery-line`:
  - duplicate enqueue coverage for `enqueueDueSchedules`
  - worker crash / stale-lease recovery coverage for the durable worker sweep
  - retry exhaustion coverage for dead-letter on final-attempt failure
  - scheduled occurrence exactly-once coverage for bound-run sync and unbound
    running-run duplicate prevention
  - explicit pause/delete cancellation-propagation unit coverage, including the
    best-effort path where internal cancel attempts fail but the user-facing
    schedule mutation still completes
- R6.1 onboarding is implemented on `feat/r5-r7-delivery-line`:
  - `hermes_registry` gains `onboarded_at`/`activated_at`
    (migration `0020_aio_onboarding_state.sql`)
  - `markActivatedIfNeeded` flips `activated_at` once, on first successful
    run only (idempotent DB-level guard)
  - `/api/onboarding` (GET/POST) and `OnboardingOverlay.tsx` on the
    welcome screen; activation wired into `run-orchestrator.ts`'s success
    branch, emitting `METRICS.USERS_ACTIVATED`
  - `npm run typecheck` clean, `npm run test:unit` 157/157 passing
  - manual dev-server verification is gated: the running dev server points
    at the remote Supabase project (`xeuvoaedwdmuhxdcoxcx.supabase.co`) and
    migration `0020` is not yet pushed there (no CLI access token in this
    environment); owner must run
    `npx supabase link --project-ref xeuvoaedwdmuhxdcoxcx && npx supabase db push`
    before live verification; see `docs/roadmap/R6_EXECUTION_CHECKLIST.md`
- R6.2 auth/tenant security audit is complete on `feat/r5-r7-delivery-line`:
  - origin/CSRF check (`apps/web/src/lib/security/origin-check.ts`), wired
    into `apps/web/src/middleware.ts`: rejects cross-origin unsafe-method
    `/api/*` requests, exempts `/api/billing/webhook`
  - in-memory per-user rate limiter (`apps/web/src/lib/security/rate-limit.ts`)
    applied to chat, image generation, knowledge upload, schedule creation,
    and checkout
  - `npm run typecheck` clean, `npm run test:unit` 165/165 passing
- R6.3 Paddle webhook idempotency is complete on `feat/r5-r7-delivery-line`:
  - `aio_paddle_webhook_events` table (migration `0021`), unique on
    `paddle_event_id`
  - webhook route inserts the event id before granting credits/plan tier and
    skips processing on conflict (no double-credit on Paddle redelivery)
  - `PaddlePaymentProvider.handleWebhook` parses Paddle's `event_id`
  - `npm run typecheck` clean, `npm run test:unit` 167/167 passing
  - live verification gated on a configured Paddle seller account
    (`PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`), same gate as prior surveys
- R6.4 usage/plan UX is complete on `feat/r5-r7-delivery-line`:
  - plan/credits/upgrade were already surfaced on `SettingsModal.tsx` and via
    `/api/credits`; per-toolset entitlements already shown
  - per-task credit ceiling surfaced as plain language on the "Plan" tab
    (`caps.creditBudget`, `SettingsModal.tsx`); the architecture has no
    per-operation cost model, so the per-task ceiling is the honest estimate
  - fixed a real UX bug: the chat transport threw Paddle's raw 402 JSON body
    as `error.message` (ai-sdk `DefaultChatTransport`), so an
    `insufficient_credits` rejection rendered as raw JSON with a dead "Retry".
    `AppHome.tsx` now detects that shape and renders a clean message with a
    "View plans" CTA opening `SettingsModal` to the "Plan" tab (new
    `initialTab` prop); other chat errors keep the original banner
  - `npm run typecheck` clean, `npm run test:unit` 167/167 passing
  - synthetic `resetAt` (`nextMonthlyResetAt()` in `pricing.ts`) is still a
    "1st of next UTC month" placeholder, not a real Paddle billing-cycle date
    — documented limitation, same gate as R6.3's live Paddle verification
- Product-owner approval is active for R6/R7 on
  `feat/r5-r7-delivery-line`, proceeding strictly in order R6.1 -> R6.8 then
  R7.
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

R6/R7 are now approved, proceeding strictly in order. The active execution
path is:

- R6.1 onboarding implemented; manual dev-server verification still pending
  (remote migration push gate)
- R6.2 (CSRF/origin checks, expanded rate limiting) implemented and verified
- R6.3 (Paddle webhook idempotency) implemented and verified; live Paddle
  redelivery check gated on a configured seller account
- R6.4 (usage/plan UX + `insufficient_credits` error surfacing) implemented
  and verified; 167/167 unit tests passing
- next: **R6.5** (Privacy, Legal, And Data Controls — see
  `AIO_MASTER_EXECUTION_PLAN.md` for scope). The legal text is gated on
  qualified legal review; the product controls (data export, account/data
  deletion, knowledge-source + derived-content deletion, retention) are
  implementable now.
- continue on `feat/r5-r7-delivery-line`
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
