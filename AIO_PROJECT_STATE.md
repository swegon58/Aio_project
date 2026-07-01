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
  (push migrations `0020`-`0023`, manual product checks, Paddle sandbox,
  legal review, alert transport, backup restore drill) — single list at
  `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`.
- No further R7 feature is scoped yet on `main`.
- R8 (Beta-Readiness Hardening) is approved and queued, not yet started —
  see "Next Decision Gate" below and `docs/roadmap/R8_EXECUTION_CHECKLIST.md`.
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

R8 — Beta-Readiness Hardening — is approved and queued. See
`docs/roadmap/R8_EXECUTION_CHECKLIST.md` for the exact task order and
`.claude/grill-logs/grill-log-next-build-observability-provider-adapter-2026-07-01.md`
Round 4 (Câu 14-19) for the decision record. Trigger phrase from the owner:
"build Aio tiếp" (same as "continue building Aio") — start at R8.1 with no
further clarification needed, unless the owner redirects.

Order: R8.1 error/not-found pages -> R8.2 Scheduled Tasks panel UI ->
R8.3 nav rail disabled states -> R8.4 route-level tests for high-risk
handlers (billing, Paddle webhook, account export/delete, cron) -> R8.5
per-customer secret isolation (Vault) research + scope.

The owner-side close-out checklist
(`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`) runs in parallel and does
not block R8 — same standing sequencing preference used since R6/R7
("owner tasks don't block code work").

Separate, still-unconfirmed item (not part of R8): migration
`supabase/migrations/0024_drop_legacy_knowledge.sql` is drafted but not
applied to the real database. Requires the owner's explicit go-ahead in a
future turn before running it.
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
