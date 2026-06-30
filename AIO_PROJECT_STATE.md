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
- R5 is formally merged on `main`.
- Main now contains the merged R2-R7 implementation stack:
  - R2 tool manifest/policy, durable tool calls, durable approvals, approval UI,
    and audit-log groundwork
  - R3 correlation context, telemetry helpers, internal metrics surface, SLO
    document, golden fixtures, and runbooks
  - R4 research-stage durability helpers, knowledge ingestion pipeline/docs
    APIs, knowledge center panel, and research progress UI
  - R5 durable job contract, worker runtime, Aio-owned schedules/history,
    scheduled-task execution path, and verified failure/recovery coverage
  - R6 consumer beta-readiness implementation: onboarding, auth/tenant
    security hardening, Paddle webhook idempotency, plan UX cleanup, account
    export/delete, deployment/ops docs and smoke path, weekly analytics, and
    beta invite/spend-cap gates
  - R7 Saved Agents: durable saved-agent storage, CRUD APIs, composer picker,
    and Saved Agents settings panel
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
- R6.5 privacy/data controls (product track) is complete on
  `feat/r5-r7-delivery-line`:
  - `GET /api/account/export` downloads all user-owned data as a JSON
    attachment (`gatherAccountData`, `apps/web/src/lib/account/export.ts`):
    reads every user table scoped by `customer_id`/`user_id`, strips raw
    `embedding` vectors, tolerates a failing table; rate-limited 5/min
  - `DELETE /api/account/delete` gathers Storage paths, removes objects
    best-effort, then `auth.admin.deleteUser` (cascades all 19 user tables
    via the `auth.users` FK-on-delete-cascade); requires a typed
    `{ confirm: "DELETE" }` body; rate-limited 2/min; client signs out on
    success (`apps/web/src/lib/account/delete.ts`)
  - new "Data & Privacy" tab in `SettingsModal.tsx`; handlers
    (`handleExportData` blob download, `handleDeleteAccount` sign-out +
    redirect) in `AppHome.tsx`
  - delete-knowledge-source + derived content already existed (`/api/knowledge`
    DELETEs + cascade) — re-confirmed by inspection, no new code
  - `npm run typecheck` clean, `npm run test:unit` 173/173 passing
  - legal text (Terms/Privacy/AUP) and configurable retention are deferred
    to their gates (qualified legal review / published retention policy); no
    fabricated policy text was written
  - live export/delete exercise is gated on remote migration parity
    (migrations `0020`/`0021` not yet pushed to
    `xeuvoaedwdmuhxdcoxcx.supabase.co`), same gate as R6.1/R6.3
- R7 Saved Agents is code-complete and unit-verified on
  `main` (R7's evidence gate explicitly waived by direct
  owner instruction — see `docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md`
  "Evidence" and `docs/roadmap/R7_EXECUTION_CHECKLIST.md`):
  - migration `0023_aio_saved_agents.sql` (service-role only, RLS enabled)
  - `apps/web/src/lib/aio/saved-agents/saved-agents.ts` (validation + CRUD)
    and `/api/saved-agents` (+`/[id]`) routes
  - saved-agent instructions append to the existing instructions array after
    `GUARDRAIL_SYSTEM_PROMPT`/`planInstructions`/`researchInstructions`,
    never before or in place of them; `useKnowledge: false` skips
    `buildKnowledgeContext` for that turn
  - composer picker (`SavedAgentMenu.tsx`) and a new "Saved Agents" Settings
    tab (`SavedAgentsPanel.tsx`)
  - `npm run typecheck` clean, `npm run test:unit` 205/205 passing (5 new)
  - manual dev-server verification gated on the same remote-migration-push
    gate as R6.1/R6.3/R6.5/R6.7 (migrations `0020`-`0023` not yet pushed to
    `xeuvoaedwdmuhxdcoxcx.supabase.co`)
- Owner-side close-out items still remain before the old R6/R7 line is fully
  closed:
  - push remote Supabase migrations `0020`-`0023`
  - run manual product walkthroughs for onboarding, export/delete, analytics,
    and Saved Agents
  - configure Paddle sandbox and run billing e2e + webhook replay
  - get legal review on the draft Terms / Privacy / AUP
  - provision alert transport
  - run the backup restore drill
  - use `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` as the single owner
    checklist for these remaining steps
- No further R7 feature is scoped yet on `main`.
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

The old R6/R7 product line is now merged on `main`.

The remaining close-out path is:

- finish the owner-side checklist in
  `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`
- after those owner actions are complete, update this state file and the
  R6/R7 checklists to mark the remaining gates closed
- do not start a new product delivery phase from stale feature-branch notes;
  use `main` as the source of truth

No later product feature after the current R7 Saved Agents scope is approved
yet. If the owner wants to move on, the next step must be an explicit new
approval or direction change.
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
