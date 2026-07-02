# Aio Project State

**Canonical repository:** `/home/swegon/AI_Agent/Aio_project`  
**Canonical branch:** `main`  
**Current main status:** run `scripts/aio-context.sh` for the exact live HEAD
**Most recent verified CI before this state update:** GitHub Actions run `28318122604`, all jobs passed
**Updated:** 2026-07-02 (Product-Ready Master Plan added)

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
- Current local operational hardening runs on `feat/aio-team-os`; `main`
  remains the canonical product truth and merge base.
- Aio Team OS quick view:
  - `bash scripts/aio-team-os.sh progress` shows the grilled Team OS plan
    progress (`85%` at the latest verification).
  - `bash scripts/aio-team-os.sh doctor` verifies the Team OS local operating
    surface, including declared-vs-computed progress.
- The local always-on stack is now managed by user services plus one helper
  command:
  - `scripts/aio-online.sh install|start|restart|status|logs|stop`
  - `aio-hermes.service`
  - `aio-hermes-supervisor.service`
  - `aio-app.service`
- R5 (durable jobs/schedules), R5.5 (failure/recovery), and R5.6 (test
  coverage) are merged and verified on `main` — see
  `docs/roadmap/R5_EXECUTION_CHECKLIST.md` for detail.
- R6.1-R6.7 (onboarding, auth/tenant security, billing idempotency, plan UX,
  account export/delete, deployment/ops, analytics) are engineering-complete
  and merged to `main` — see `docs/roadmap/R6_EXECUTION_CHECKLIST.md` for
  detail (migration numbers, file paths).
- R7 Saved Agents is code-complete, unit-verified, and merged to `main`
  (R7's evidence gate explicitly waived by direct owner instruction — see
  `docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md` "Evidence") — see
  `docs/roadmap/R7_EXECUTION_CHECKLIST.md` for detail.
- Owner-side close-out items remain before the R6/R7 line is fully closed
  (manual product checks, Paddle sandbox, legal review, alert transport,
  backup restore drill) — single list at
  `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`. All migrations `0001`-`0025`
  are applied remotely (verified 2026-07-02, includes `0024`/`0025` — owner
  go-ahead given same day).
- No further R7 feature is scoped yet on `main`.
- R8 (Beta-Readiness Hardening) is complete: R8.1-R8.4 implemented and
  verified (249/249 unit tests, typecheck/eslint clean). R8.5's finding
  (all customers shared one Aio-owned OpenRouter/Daytona provider key) was
  decided and wired same-day (2026-07-01): owner chose per-customer,
  Aio-provisioned OpenRouter keys with a hard monthly spend ceiling.
  `writeProfileEnv` (`apps/web/src/lib/hermes/provision.ts`) now calls
  `provisionOpenRouterKey` + `storeOpenRouterKeyInVault` when
  `OPENROUTER_PROVISIONING_KEY` is set (falls back to the old shared-key
  behavior when unset); new migration `0025_openrouter_key_hash.sql`
  (drafted, not applied). Daytona key remains shared (out of scope this
  round). Verified: typecheck/eslint clean, 249/249 tests. Migration `0025`
  is applied (2026-07-02). Remaining step is owner-only (create the
  Management/Provisioning key, paste into `.env.local`) — see
  `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` "R8.5 Finding" and
  `docs/roadmap/R8_EXECUTION_CHECKLIST.md`.
- R9 (Deep Research Polish, owner-selected option B from the prior Next
  Decision Gate, 2026-07-01) is complete: R9.0-R9.3 all `[x]` — see
  `docs/roadmap/R9_EXECUTION_CHECKLIST.md`. Wired the previously-orphaned
  durable research pipeline (`research-stages.ts`) into the live
  orchestrator with a 7-stage progress state machine and real source
  persistence (R9.0); added application-level source dedupe with unit
  coverage (R9.1); added Markdown/PDF report export buttons (R9.2); added
  a per-message sources panel backed by a new `GET /api/runs/[runId]/sources`
  route (R9.3). Verified: typecheck/eslint clean, 258/258 unit tests, and
  a new Playwright e2e spec (`apps/web/e2e/research-export.spec.ts`) that
  drives a full research-mode chat turn through the real `/app` UI and
  exercises the export buttons and sources panel end-to-end (kept as
  permanent regression coverage — the Claude Chrome extension remains
  disconnected in this environment, so this is the live-verification
  substitute, same pattern as R8.2). Deliberately out of scope: claim-level
  citation linking and a DB-level dedupe uniqueness constraint (see
  `docs/roadmap/R9_EXECUTION_CHECKLIST.md` "Status"). No further phase is
  approved yet — see "Next Decision Gate" below.
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
- `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md` added (2026-07-02, owner
  request via Discord): a 5-phase checklist (Observability & Safety Net,
  Compliance & Trust Groundwork, Reliability & Performance Validation,
  Product Depth & Retention, Strategic Direction) covering everything needed
  to bring Aio to "could flip to public anytime" — the owner's grilled scope
  answer that day (Option 1: harden compliance/reliability/legal now, but no
  public marketing/pricing site or i18n yet). This plan runs separately from
  and does not block R10 (`R10_EXECUTION_CHECKLIST.md`, already in flight)
  or the R6/R7 owner close-out list (`OWNER_CLOSEOUT_CHECKLIST.md`) — it
  cross-references both where scope overlaps. 10 new specialist agents were
  imported into `.claude/agents/` from the `agency-agents` repo to staff it:
  `sre-engineer`, `performance-benchmarker`, `accessibility-auditor`,
  `technical-writer`, `trend-researcher`, `ux-researcher`,
  `sprint-prioritizer`, `data-privacy-officer`, `legal-compliance-checker`,
  `analytics-reporter`. No phase has started execution yet — this is the
  planning artifact only; see "Next Decision Gate" below for what's approved
  to start.

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
