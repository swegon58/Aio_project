# Aio Project State

**Repo:** `/home/swegon/AI_Agent/Aio_project` · **Canonical branch:** `main`
**Updated:** 2026-07-09 — R14 (codebase cleanup) merged to local `main`
(FF, tip `e33b878`); **local `main` is ahead of `origin` ~40 commits — not
pushed** (owner gate). R12/R13 shipped earlier; R13 has owner-pending items
(migration `0033`, `OPENROUTER_API_KEY` liveness, Gate B) — see R13 checklist.

First file an agent reads. Status index only — detail lives in phase checklists.

## Current Status

**Branches:** local `main` holds R0–R14 (R14 merged 2026-07-09 via FF, tip
`e33b878`). `origin/main` lags — **not pushed** (owner gate). Refactor branch
`refactor/r14-codebase-cleanup` merged and can be deleted.

**Closed phases (R0–R9):** all merged to `main`. One-liner each in
`docs/archive/CLOSED_PHASES.md`; full detail in `docs/archive/roadmap/`.

**R10 (notifications + Google Calendar) — shipped, owner-gate open:** engineering
complete; migrations `0026`/`0027` applied on cloud (live dev target), so
`/api/notifications` + `/api/connections/google` return 200. Remaining: owner-side
Google Cloud OAuth consent screen (4 items in
`docs/roadmap/R10_EXECUTION_CHECKLIST.md`).

**R11 (settings) — shipped:** R11.1–R11.5 (Account/Notifications/Memory tabs,
composer tray, terminal/workspace polish, vision, spend-cap sub-limits).
Migrations `0028`–`0030` pushed to remote. One onboarding no-op question
deliberately deferred.

**R12 (AppHome decomposition + open-webui) — committed this session:**
- **AppHome refactor DONE** (`5e10f45`): 11 hooks + 3 contexts + 6 sections,
  4000→1300 lines. Playwright desktop green, 264/264 unit tests.
- **open-webui RAG/Valves** (`f4ce9f4`): migration `0031` hybrid BM25+vector
  search, `0032` tool valves, `/api/account/valves`, Settings Knowledge tab,
  `prompt-variables.ts`, internal knowledge endpoints, `[N]` research citations.
  Migrations `0031`/`0032` now **applied to cloud** (live).
- **UI polish** (`d464723`): sidebar/composer CSS, mobile LAN config fix.
- **Deferred:** T1.3 knowledge-as-tool wiring + Tier-3 UX (blocked/rate-limited).

**R13 (invite-alpha hardening) — in progress:** 6-agent audit (2026-07-08)
scored 6.1/10 against invite-only-alpha bar; plan in
`docs/roadmap/R13_EXECUTION_CHECKLIST.md`. Same day: knowledge-route schema
fix done, real approval path now calls `resolveApproval()`, run
watchdog/lease/sweep + Stop-race fix coded (migration `0033_aio_runs_lease.sql`
written, **not applied** — owner-gated), all `tsc --noEmit` clean. **Gate A
closed:** per-customer Hermes provisioning already built/live
(`provision.ts`, `hermes_registry`) — old "shared memory profile" finding was
the local-dev auth-bypass path, not prod. Real remaining gaps: unset
`OPENROUTER_PROVISIONING_KEY` (shared-key spend-cap bypass), unconfigured
per-profile Honcho, shared Daytona key, prod catalog coupled to dev profile —
itemized in R13.0. Open: apply `0033` + live-verify watchdog, Gate B
(Connected Apps fate). Same day, owner flagged Deep Research UX as
sub-standard (vs. ChatGPT/Gemini plan-card + live-progress + result-surface
pattern) — audited (fork), 4 gaps confirmed real, remediation plan written
as R13.3 in the checklist; 2 of 4 are cheap (existing correct data is just
unwired to the wrong UI component), 2 are real feature work (question-specific
plan generation, depth guardrail). **Now built** (2026-07-08, all 4 items):
items 1-2 (progress-card swap, report→Workspace panel) shipped and
reality-checked READY/HIGH; items 3-4 (plan-card + depth guardrail)
backend+frontend done, `tsc`/unit/Playwright green, kimo's 3 plan-card UI
findings fixed same day. Open, owner-side: confirm `OPENROUTER_API_KEY`
resolves in the live `aio` profile (401 blocked live smoke test — plan card
silently never appears if the key is actually dead), depth-guardrail is
`console.warn`-only (no real quality eval done), confirm-gate vs. auto-start
UX left as auto-start default (revisit if a closer Gemini-match wanted).
Detail: `docs/roadmap/R13_EXECUTION_CHECKLIST.md` R13.3.

**R14 (codebase cleanup) — ✅ COMPLETE, merged to `main` (FF `e33b878`, 2026-07-09).**
Pure behavior-preserving refactor (11 commits). Shipped: Phase 1 test-net
(`eef1b70`) · Phase 2 dedup (`94622d5`) · Phase 3 tool-manifest split
(`9af53ab`, real win; schedule/run-orch bulk assessed irreducible, test-nets
added `0290081`) · Phase 4 IconRail extract (`50fe3ff`, kills duplicate
`ICON_RAIL_ITEMS` render — the selector-pain root cause) + mockup CSS split
at natural seams (`caa08be`) · Phase 5 `.next-e2e` Playwright isolation
(`ff32a9d`, retires the "stop aio-app.service before e2e" rule) + `test:watch`
+ compose-rename (`cd5ed33`) + `dev.sh`/`bootstrap.sh`/env header (`e8734c1`).
tsc + 317/317 unit + Playwright verified (4 mobile fails pre-existing).
Checklist archived to `docs/archive/roadmap/R14_CODEBASE_CLEANUP.md`; index
line in `docs/archive/CLOSED_PHASES.md`.

## Open Decision Gates (owner)

1. **Internal knowledge endpoints → Hermes wiring** — code complete; owner
   decides if/when to expose as Hermes tools.
2. **Push local `main` → `origin/main`** — owner controls deploy/CI timing.
3. 🚨 **Stuck run `66a29fab-ce6f-40e1-8914-c2fc73528361`** — `running` since
   2026-07-03; live state, needs owner go-ahead before anyone touches it.
4. ~~R13 Gate A~~ — ✅ closed 2026-07-08 (see above).
5. **R13 Gate B — Connected Apps / Model Providers fate** — hide from
   non-owner accounts now vs. invest in a real OAuth-style redesign.

> ✅ Closed 2026-07-07: migrations `0031`/`0032` applied to cloud (was gate 1).

**Standing decisions:** keep the product line on `main`; no history rewrite for
the old `.mcp.json` secret exposure (current-tree protection + CI scanning is the
closure boundary); owner close-out items (Paddle, legal, alerts, backup drill) at
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`, don't block engineering.

**Parallel lane:** `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md` — 5-phase
"could-flip-public" hardening. Multi-runtime idea (DeerFlow/Onyx) deferred — see
`docs/archive/roadmap/FUTURE_MULTI_RUNTIME_CANDIDATE.md`.

**Local stack:** `scripts/aio-online.sh start|status|logs` manages
`aio-hermes`/`aio-app` services. `scripts/aio-context.sh` for a live HEAD/CI
snapshot. Aio Team OS: `scripts/aio-team-os.sh progress|status|doctor`.

## Required Reading Order

1. `AIO_PROJECT_STATE.md` (this file)
2. Active checklist: `docs/roadmap/R13_EXECUTION_CHECKLIST.md` (R10–R12
   shipped/closed; R14 merged & archived to `docs/archive/roadmap/`)
3. `MEMORY.md` (auto-loaded index)

On demand: `README.md` (setup), `docs/operations/*` (runbooks),
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` (owner items),
`AIO_GIAI_THICH_DE_HIEU/R10-R12` (plain-Vietnamese explainers).
Forensics (never auto-loaded): `docs/archive/CLOSED_PHASES.md` → `docs/archive/*`.

## "Continue Building Aio"

1. `scripts/aio-context.sh` → confirm repo, branch, CI, services.
2. Read this file + the active checklist.
3. Continue an approved in-progress task, or present the next decision gate with
   concise A/B/C options and the recommended one marked.
4. **After a phase closes:** `git mv` its checklist to `docs/archive/roadmap/`,
   add one line to `docs/archive/CLOSED_PHASES.md`, trim this file — **same
   session** (this is the fix for the state-lag that forced the R12 reorg).

## Update Contract

Update this file whenever a phase/feature is approved, a branch merges, a task
blocks, CI materially changes, or runtime commands change. Never record secrets,
raw provider responses, personal prompt content, or uncommitted runtime-state
details.
