# Aio Project State

**Canonical repository:** `/home/swegon/AI_Agent/Aio_project`  
**Canonical branch:** `main`  
**Current main status:** run `scripts/aio-context.sh` for the exact live HEAD
**Most recent verified CI before this state update:** GitHub Actions run `28318122604`, all jobs passed
**Updated:** 2026-07-02 (Product-Ready Master Plan added)

This is the first file an agent reads to learn current location and progress.
It is a status index, not a replacement for the master plan or phase checklist.

## Current Status

- R0-R9 are all closed/merged on `main`. One-line-per-phase summary (see each
  phase's `docs/roadmap/R*_EXECUTION_CHECKLIST.md` if historical detail is
  ever needed — not required for day-to-day work):
  - **R0** CI/production safety closure. **R1** durable run foundation.
    **R2** tool governance + durable approvals. **R3** observability/SLOs.
    **R4** durable deep research + knowledge pipeline. **R5** background
    workers + scheduled tasks (incl. R5.5 failure/recovery). **R6**
    consumer beta readiness (onboarding, auth/tenant hardening, billing,
    export/delete, ops, analytics). **R7** Saved Agents.
  - **R8** beta-readiness hardening, complete; R8.5 resolved as
    per-customer, Aio-provisioned OpenRouter keys with a spend ceiling
    (migration `0025`, applied).
  - **R9** Deep Research polish, complete: durable 7-stage research
    pipeline, source dedupe, MD/PDF export, per-message sources panel.
    Deferred: claim-level citations, DB-level dedupe constraint.
  - All migrations `0001`-`0025` applied remotely. Owner close-out items
    (Paddle sandbox, legal review, alert transport, backup drill) tracked
    at `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`, don't block engineering.
- Standing decisions still in force: keep R5/R6/R7 on one delivery branch;
  don't rewrite git history for old `.mcp.json` secret exposure (current-tree
  protection + CI scanning is the closure boundary); keep the product line
  on `main`, no new phase-specific worktrees unless owner asks.
- `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md` (added 2026-07-02): 5-phase
  hardening checklist for "could flip to public anytime" (no public
  marketing/i18n yet). Runs parallel to R10, doesn't block it. No phase
  started yet.
- A multi-runtime idea (DeerFlow/Onyx/OpenHands alongside Hermes) was
  **explicitly deferred** after a grill (2026-07-03) — see
  `docs/roadmap/FUTURE_MULTI_RUNTIME_CANDIDATE.md`. Revisit after
  Product-Ready Phase 1. Not active; don't build from the report.
- Aio Team OS: `bash scripts/aio-team-os.sh progress` / `status` / `doctor`
  for the local Team OS operating surface (last verified doctor-clean).
- Local always-on stack: `scripts/aio-online.sh install|start|restart|status|logs|stop`
  manages `aio-hermes.service`, `aio-hermes-supervisor.service`, `aio-app.service`.

### R10 — active, in flight on `feat/r10-notifications` (uncommitted)

- **R10.2 (Proactive Notifications)**: complete (`3d45fb9`, `77fb3db`) —
  migration `0026`, notifications API + `NotificationsPanel` + unread badge,
  Discord toggle in `ScheduledTasksModal`. Verified: typecheck/lint,
  258/258 unit tests.
- **R10.1 (Google Calendar Connect)**: engineering + UI-verification
  complete (2026-07-03) — OAuth routes, `google-calendar.ts`, migration
  `0027`, vault-backed refresh token, Settings connect/disconnect card.
  Owner's Google Cloud setup done; server-side OAuth live-verified.
  Playwright self-test (`google-calendar-connect.spec.ts`) + Kimo UI
  review together found and fixed 8 real UI bugs (CSS flex-squeeze hiding
  status text — same bug recurred in `NotificationsPanel.tsx`; stale-tab
  bug after OAuth callback; Critical: Settings unusable on mobile;
  error-color/accent collision; invisible delete-account border;
  accent-swatch mismatch; inconsistent input styling; raw error text).
  Full list + evidence: `docs/roadmap/R10_EXECUTION_CHECKLIST.md` "R10.1".
  Verified: `tsc` clean, lint clean, 258/258 unit, 12/12 Playwright e2e.
  One flagged gap not fixed: no retry affordance on error states.
- **Open blocker, needs owner go-ahead**: `/api/notifications` and
  `/api/connections/google` 500 in the live dev app — migrations `0026`/
  `0027` exist locally but were never pushed to the linked remote Supabase
  project (confirmed via `supabase migration list --linked`). Not a code
  bug. Pushing is a shared-DB change — needs explicit approval.

## Worktree Roles

- `/home/swegon/AI_Agent/Aio_project`
  - Canonical product repository.
  - Use `main` for product truth; use `feat/aio-team-os` only for local
    operational hardening that does not redefine product phase approval.
  - Use for integration, verification, and running Aio.
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

R10 is approved (owner grill decision, 2026-07-02, Discord — "1b 2a"),
sourced from three parallel research forks (market landscape, tools/repos,
internal gap audit) synthesized into a two-question grill. See
`.claude/grill-logs/grill-log-next-flagship-phase-2026-07-02.md` for the
full record and `docs/roadmap/R10_EXECUTION_CHECKLIST.md` for scope:

- Primary flagship: **Google Calendar consumer connect flow** (OAuth,
  Calendar-only for this pass — Gmail/Drive deferred pending a Google CASA
  restricted-scope review, a compliance step, not an engineering one).
- Parallel: **Proactive notifications** — closes the R5.4 "notification
  destination" field that was spec'd but never built for Scheduled Tasks.

R10.2 (notifications) has no external blocker and can start immediately.
R10.1 (connect flow) needs an owner-only Google Cloud OAuth app + consent
screen setup before it can be live-verified end to end; engineering can
proceed on routes/migration/UI shell in parallel — see the checklist's
"Owner-only" section.

R8 (Beta-Readiness Hardening) and R9 (Deep Research Polish) are both
complete — see `docs/roadmap/R8_EXECUTION_CHECKLIST.md` and
`docs/roadmap/R9_EXECUTION_CHECKLIST.md`. The R8.5 per-customer-key model
decision is resolved and implemented (OpenRouter; see "Current Status"
above) — its remaining steps are owner-only env/migration actions, not an
open engineering decision.

Deferred, not part of R10 (may resurface as a future gate):

- Claim-level citations for Deep Research (deliberately deferred from R9):
  wire `recordResearchClaim` with a new LLM-driven claim-extraction step.
- Extend per-customer key isolation to Daytona, or wire
  `updateOpenRouterKeyLimit` into the billing webhook for tier-change
  spend-ceiling sync.

The owner-side close-out checklist
(`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`) runs in parallel and does
not block engineering work — same standing sequencing preference used
since R6/R7 ("owner tasks don't block code work").

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
