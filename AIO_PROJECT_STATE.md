# Aio Project State

**Repo:** `/home/swegon/AI_Agent/Aio_project` · **Canonical branch:** `main`
**Updated:** 2026-07-07 — R12 (AppHome decomposition + open-webui RAG/Valves)
committed on `feat/r12-fixes` and ff-merged into local `main`; **not pushed to
`origin`**. Migrations `0031`/`0032` **applied to cloud Supabase** this session
(cloud now at `0001`–`0032`); `0031` fixed first — it referenced the dropped
`hermes_knowledge_chunks` table and was corrected to `aio_knowledge_chunks`.

First file an agent reads. Status index only — detail lives in phase checklists.

## Current Status

**Branches:** `feat/r12-fixes` holds all of R10+R11+R12; ff-merged into local
`main` (2026-07-07). `origin/main` lags (not pushed). R10/R11 sub-branches were
merged in earlier (`main` tip was `193bb77 Merge feat/r11-settings`).

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

## Open Decision Gates (owner)

1. **Internal knowledge endpoints → Hermes wiring** — code complete; owner
   decides if/when to expose as Hermes tools.
2. **Push local `main` → `origin/main`** — owner controls deploy/CI timing.
3. 🚨 **Stuck run `66a29fab-ce6f-40e1-8914-c2fc73528361`** — `running` since
   2026-07-03; live state, needs owner go-ahead before anyone touches it.

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
2. Active checklist: `docs/roadmap/R12_EXECUTION_CHECKLIST.md` (R10/R11 stay
   readable while owner OAuth is pending)
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
