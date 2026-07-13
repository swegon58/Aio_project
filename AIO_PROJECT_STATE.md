# Aio Project State

**Repo:** `/home/swegon/AI_Agent/Aio_project` · **Canonical branch:** `main`
**Updated:** 2026-07-13. **`main`/`origin/main` sit at `99058d7` (R15 A–E
tip). `r15-plan-research-rebuild` has since fast-forwarded to `db97a5c` —
R16 was FF-merged into it (`git reflog`: `merge r16-wire-hermes-capabilities:
Fast-forward`) — so R16 lives on the working branch but is NOT on `main` and
NOT pushed (`origin/r15-plan-research-rebuild` is 1 behind at `99058d7`).**
Pre-2026-07-13 history: local `main` was FF'd to `origin/main` (`99058d7`,
true FF via `git merge-base --is-ancestor`) after discovering `origin/main`
on GitHub was already at the then-`r15-plan-research-rebuild` tip — pushed
directly, not via a tracked PR (origin of the direct push unconfirmed,
current remote state treated as ground truth per owner instruction). R10/R13
still have owner-pending gates (below); R11, R12, R14 fully shipped, no open
items.

**🚧 Active working-tree issue (2026-07-13, updated):** the three files STATE
previously flagged for stale `git stash pop` conflict markers
(`SettingsModal.tsx`, `research-mode.ts`, `research-mode.test.ts`) are now
**marker-free** — grep `<<<<<<<|>>>>>>>|=======` = 0 matches across all three
(verified 2026-07-13, no `.git/MERGE_HEAD`). R16's SettingsModal tabs
(`plan`/`credentials`/`skills`) are present on the branch (R16 FF won over
the R15 cleanup). The working tree still holds uncommitted mobile/UX work
+ fal.ai swap + `R17_CANDIDATE_PLAN.md`/`R17_EXECUTION_CHECKLIST.md`/
`COMPETITIVE_BACKLOG.md`. **These are real work — don't lose them on push.**
T1#0 in R17 checklist handles the dirty-tree-then-push sequence.

First file an agent reads. Status index only — detail lives in phase checklists.

## Current Status

**Branches:** `main`/`origin/main` at `99058d7` (R0–R15 A–E).
`r15-plan-research-rebuild` has moved to `db97a5c` (R16 FF-merged in) — 1
ahead of `origin`, not on `main`, not pushed. E14 (design-ops proposal),
the R16 work, and the uncommitted working-tree changes below are not yet
folded into `main`. Refactor branch `refactor/r14-codebase-cleanup` merged
and can be deleted.

**Closed phases (R0–R9):** all merged to `main`. One-liner each in
`docs/archive/CLOSED_PHASES.md`; full detail in `docs/archive/roadmap/`.

**R10 (notifications + Google Calendar) — shipped, owner-gate open:**
engineering complete, migrations `0026`/`0027` live on cloud. Remaining:
owner-side Google Cloud OAuth consent screen. Detail:
`docs/roadmap/R10_EXECUTION_CHECKLIST.md`.

**R11 (settings) — shipped, no open items:** Account/Notifications/Memory
tabs, composer tray, terminal/workspace polish, vision, spend-cap sub-limits.
Migrations `0028`–`0030` on remote. Detail:
`docs/roadmap/R11_EXECUTION_CHECKLIST.md`.

**R12 (AppHome decomposition + open-webui) — shipped, no open items:**
AppHome refactor (`5e10f45`, 4000→1300 lines, 11 hooks/3 contexts/6 sections);
open-webui RAG/Valves (`f4ce9f4`, migrations `0031`/`0032` live on cloud, hybrid
BM25+vector search, Settings Knowledge tab, `[N]` research citations); UI
polish (`d464723`). Deferred: T1.3 knowledge-as-tool wiring + Tier-3 UX
(blocked/rate-limited). Detail: `docs/roadmap/R12_EXECUTION_CHECKLIST.md`.

**R13 (invite-alpha hardening) — shipped, Gate B open:** 6-agent audit
(6.1/10) remediated same day (2026-07-08): knowledge-route schema fix, real
approval path via `resolveApproval()`, run watchdog/lease/sweep + Stop-race
fix (migration `0033_aio_runs_lease.sql` written, **not applied** —
owner-gated). Gate A closed (per-customer Hermes provisioning already
live). Deep Research UX gap vs. ChatGPT/Gemini pattern — all 4 remediation
items shipped + reality-checked READY/HIGH. Open: apply `0033` + live-verify
watchdog; confirm `OPENROUTER_API_KEY` resolves in the live `aio` profile
(401 blocked the last live smoke test); Gate B (Connected Apps / Model
Providers fate, see gates below). Detail:
`docs/roadmap/R13_EXECUTION_CHECKLIST.md`.

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

**R15 (plan/research rebuild + streaming + panel cleanup) — A/B/C/D/E ✅
complete, live on `main`.** Branched from `main` (`5961baa`), now at `main`
tip `99058d7` (see Branches note above — pushed directly to `origin/main`,
no separate merge step left).
**A** chat-stream jitter fixed (sticky-bottom + instant autoscroll,
`393a5cc`); **B** "Current Run" + "Today" panel cards removed (`9f799e3`);
**C** plan + research rebuilt into unified grill → summary → HITL-approve →
run flow (`aio-questions` batch, Next/Back wizard, `aio_approvals` reuse,
`isFinalPlanShape` approval-gate fix) — tsc clean, `e2e/plan-wizard.spec.ts`
4/4 green; **D** docs/state sync done; zero deer-flow contamination
(`D3`). **E** Discord UI feedback backlog:
- **E1–E12 ✅** (icon-rail/glass/font/shadow/vision-attachment/e2e regression
  fixes + light-mode shadow scope) — 12 items closed; tsc clean, 348/348 unit,
  Playwright green. Light-mode shadow (E12, 2026-07-11) scoped to
  `.aio-mockup[data-theme="light"]` override only; base `--shadow-sm/md/lg: none`
  was deliberate then.
- **E13 ✅** (Terminal card margin + dark-theme shadow restore, 2026-07-12):
  added `margin: 0 12px 12px` to `.aio-terminal` + restored base `--shadow-sm/md/lg`
  tokens + added `box-shadow: var(--shadow-sm)` to `.aio-terminal` CSS. Root cause:
  (1) `.aio-terminal` had zero margin vs. sibling `.right-panel` padding pattern;
  (2) owner reversed 2026-07-11 shadow-removal decision for dark theme, same day.
  CSS verified/staged. **NOT live-verified** (Chrome extension unavailable).
- **E14 ⏳** (design-ops process + library proposal, pending owner approval):
  recorded in checklist as 4-item action list: (1) `/impeccable document`
  → `DESIGN.md` token registry + changelog; (2) enable `/impeccable hooks on`
  for live design-issue detection; (3) add token-file rule to `agent-pipeline`
  SKILL.md (token changes auto-route to `kimo` for consistency); (4) rename
  `mockup.css`/`mockup/` → `design-system.css`/`ui/` (current code mislabeled
  as mockup). Research: agency-agents roster already has 18 specialists
  (kimo, product-ux-guardian, accessibility-auditor, ux-researcher,
  frontend-builder); shadcn/ui+Tailwind+Radix stack confirmed 2026 industry
  standard; real gap = missing `DESIGN.md` + unfinished `impeccable` hooks
  wiring. No files edited/executed — awaiting owner approval in next session.

Detail: `docs/roadmap/R15_EXECUTION_CHECKLIST.md`. Known pre-existing gap:
Notifications feature has no UI entry point since E11 removed icon-rail bell
— owner to decide resurface or permanent removal.

**Uncommitted tree, beyond the itemized E-series:** `git status` shows
further working-tree changes not yet folded into a checklist item —
confirmed via diff: image generation provider migrated Kie.ai→fal.ai
(`api/images/generate/route.ts` now calls `fal-client.ts`, needs
`FAL_API_KEY` instead of `KIE_API_KEY`; README updated to match). Other
touched files (`SettingsModal.tsx`, `useConnections.ts`, `AppModals.tsx`,
`Composer.tsx`, `research-mode.ts`, `credentials.ts`) not individually
re-verified this pass — run `git status`/`git diff` before assuming their
content; don't attribute them to a specific R15 sub-item without checking.

**R16 (wire existing Hermes capabilities + Deep Research prep) — Tier A +
free Tier B shipped (`db97a5c`, 2026-07-13), now FF-merged into
`r15-plan-research-rebuild`; NOT on `main`, NOT pushed (owner review +
conflict-resolution pending).**
Worktree `/home/swegon/AI_Agent/Aio_project_r16_hermes_wiring`, branch
`r16-wire-hermes-capabilities` (same commit `db97a5c`). All 7 Tier A items
done (MCP marketplace read-write, delegate/sub-agent guardrail, MoA +
`session_search` manifest entries, skill marketplace UI, Linear/n8n connect,
docx export skill), plus the two free Tier B items (MarkItDown+pdf-mcp
catalog entries, Mem0 self-host eval track). Two platform-level blockers
surfaced (documented in checklist, not fixed): `APIServerAdapter` has no
background-result delivery channel; Linear OAuth can't complete server-side
without a browser callback reachable from the connecting user. **Stopped
here per locked gates** — Firecrawl+Exa (paid, needs owner budget sign-off)
and Tier C browser-automation (needs `appsec-engineer` review) still require
explicit owner approval before proceeding. Detail:
`docs/roadmap/R16_EXECUTION_CHECKLIST.md`.

**R17 (product gap closure) — ✅ scope LOCKED 2026-07-13, in progress.**
Checklist: `docs/roadmap/R17_EXECUTION_CHECKLIST.md`. Decisions: (1) scope =
Tier 1 (4 bug fixes) + Tier 2 (5 completeness gaps); (2) push R16 to main
first as T1#0 prerequisite — conflict markers that previously blocked this
verified **gone**; (3) #1 bug ("restart the gateway" dead-end in
`useConnections.ts` AND `useCredentials.ts:60`) → honest async-pending copy,
Linear precedent, no gateway restart; (4) Tier 3 competitive bets split to
`docs/roadmap/COMPETITIVE_BACKLOG.md` (not auto-sequenced). Next step per
checklist resumption pointer: T1#0 (dirty-tree-safe push of `db97a5c` to
main), then T1#1→#4, T2#5→#9.

## Open Decision Gates (owner)

1. **Internal knowledge endpoints → Hermes wiring** — code complete; owner
   decides if/when to expose as Hermes tools.
2. ~~Push local `main` → `origin/main`~~ — ✅ closed; synced as of 2026-07-12.
3. 🚨 **Stuck run `66a29fab-ce6f-40e1-8914-c2fc73528361`** — `running` since
   2026-07-03; live state, needs owner go-ahead before anyone touches it.
   Not re-verified this pass — confirm current state before assuming resolved.
4. ~~R13 Gate A~~ — ✅ closed 2026-07-08 (see above).
5. **R13 Gate B — Connected Apps / Model Providers fate** — hide from
   non-owner accounts now vs. invest in a real OAuth-style redesign.
6. **R15 E14 — design-ops process proposal** — `DESIGN.md`, `/impeccable
   hooks on`, token-change rule, `mockup/`→`design-system/` rename. Written
   up 2026-07-12; none of the 4 items approved yet, owner reviews next
   session. Detail: `docs/roadmap/R15_EXECUTION_CHECKLIST.md` E14.
7. ~~`origin/main` anomaly~~ — ✅ closed 2026-07-12: owner said resolve and
   proceed; local `main` fast-forwarded to `origin/main` (`99058d7`, verified
   true FF first). How the direct push to `origin/main` happened is still
   unconfirmed — not re-opened unless it causes a concrete problem.

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
2. Active checklist: `docs/roadmap/R17_EXECUTION_CHECKLIST.md`
   (R10–R14 shipped, R15 A–E shipped, R16 shipped-but-not-on-main, R17 active)
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
