# R14 — Codebase Cleanup (Light & Clean)

**Status:** in progress 2026-07-08 · **Branch:** `refactor/r14-codebase-cleanup` (off clean `main` post-R13 commit) · **Multi-session**
**Progress:** Gate 0 ✅ · Phase 2 ✅ done (`94622d5` — shared state-machine + repo-types, 281/281 tests, qa-confirmed behavior preserved) · Phase 1 in progress (run-orchestrator test net)

## Context

3-agent audit (2026-07-08, backend + frontend + dev-env) found the codebase
expensive to read and edit: a 916-line backend god-object (`run-orchestrator.ts`),
3 duplicated patterns spread across 9 files, a 1330-line frontend component
(`AppHome.tsx`) with one data array rendered in two places (the root cause of
the "DOM selector points nowhere" pain), and a 5-step dev setup with `.next`
build-lock contention. Nothing here is a feature; this is a behavior-preserving
cleanup so every file is light enough to read/edit in one pass, patterns are
deduped, and the dev loop is one command. **Backend first** (owner priority),
then frontend, then dev-env.

## Principles

- **Ponytail / Karpathy:** smallest correct split. No speculative abstraction —
  extract a shared base only where ≥2 real consumers already share the pattern
  (audited: state-machine ×4, repo-types ×5, event-writer ×3 — all genuine).
- **Behavior-preserving:** every phase keeps `tsc --noEmit` + existing tests
  green. UI phases add a live Playwright run. Refactor, not rewrite.
- **One concern per phase** → reviewable diffs, easy rollback.
- **Delegate to specialists** (backend-builder / frontend-builder /
  minimal-change-engineer / qa-reviewer / kimo) — main thread stays light.

## Gate 0 — Clean base (BLOCKS everything)

Commit the uncommitted R13 work as one R13 ship commit, then branch.

- R13 code is already `tsc` + unit + Playwright green (per `AIO_PROJECT_STATE.md`).
  The dirty working tree IS the R13 work (knowledge-route schema, approvals
  wiring, watchdog/`0033` code, R13.3 Deep Research UX).
- Owner-pending items stay tracked in `R13_EXECUTION_CHECKLIST.md` and are NOT
  blockers for the commit: apply migration `0033` (owner-gated), confirm
  `OPENROUTER_API_KEY` liveness, Gate B (Connected Apps), push to `origin`.
- Inspect `git status` first — confirm every changed file belongs to R13, no
  stray experiments. Commit with a scoped R13 message. Then
  `git checkout -b refactor/r14-codebase-cleanup`.

## Phase 1 — Safety net (test net before carving)

Add characterization tests locking current behavior on the pieces Phase 3 carves.

- Targets: `run-orchestrator.ts`, `run-repository.ts`, `schedule-repository.ts`,
  `job-repository.ts`.
- Existing coverage is thin (6 test files / 51 API routes); do not carve
  core paths without a net.
- **Agent:** `qa-reviewer`. **Gate:** new tests green, zero behavior change.

## Phase 2 — Backend dedup foundation (low risk, mechanical)

Extract shared bases where the audit proved real duplication.

- `lib/aio/shared/state-machine.ts` — base for run/job/tool-call/approval
  state machines (4 consumers, same `isTerminal/canTransition/transition`).
- `lib/aio/shared/repository-types.ts` — `RepoResult/RepoOk/RepoError`
  (5 repositories redefine these locally).
- `lib/aio/shared/event-writer-base.ts` — tool-call/approval/run-event writers
  (3 consumers, same `record*Event` + stable-ID + snapshot + transition shape).
- **Agent:** `backend-builder`. **Gate:** `tsc --noEmit` + full unit suite green.

## Phase 3 — Backend god-object carve (high payoff, needs Phase 1 + 2)

- `run-orchestrator.ts` (916L) → auth-guard + billing-orchestrator +
  hermes-client + event-pipeline + run-lifecycle.
- `schedule-repository.ts` (709L) + `schedule-runtime.ts` (643L) → split per audit
  (CRUD vs occurrence vs run-binding vs enqueue vs executor).
- `tool-manifest.ts` (562L) → `tool-metadata-constants.ts` (data) vs logic.
- `aio-run-events.ts` (272L) → run/tool/research/artifact event-type modules.
- **Agent:** `backend-builder` + `qa-reviewer` verify. **Gate:** Phase 1 tests
  still green + `tsc`.

## Phase 4 — Frontend extraction (Playwright verifies)

- Extract `<IconRail>` component — kills the duplicate `.map()` over
  `ICON_RAIL_ITEMS` in `AppHome.tsx:1142` + `FloatingChrome.tsx:73`. This is
  the direct fix for the selector pain that started this phase.
- Extract AppHome hooks: `useIconRail`, `useWorkspaceEntries`,
  `useRunStatusMessage`, `useActiveFile`, `useTimelineEvents`,
  `useRailItemNavigation`. Target: `AppHome.tsx` 1330 → <900.
- Extract `settings-tabs.ts` (kill `SETTINGS_TABS` / `ICON_RAIL_KEYS` dup).
- Split oversized CSS: `05-right-panel.css` (1031L), `04-input-area.css` (889L),
  `02-sidebar-icon-rail.css` (597L).
- Split `useRunTimeline.ts` (315L) → events/approval/sync.
- **Agent:** `frontend-builder` + `kimo` review. **Gate:** stop
  `aio-app.service` → run relevant Playwright specs → restart service (per
  `CLAUDE.md` `.next` lock rule).

## Phase 5 — Dev-env standard (low risk, QoL)

- Root `npm run dev` orchestration (web + hermes in one command).
- Split `.env.local.example` → required/optional; document cloud Supabase target
  (xeuvo… per memory, not local Docker).
- Fix `apps/web/docker-compose.yml` legacy `ai-website-cloner` naming.
- Resolve `.next` build-lock: Playwright separate build dir OR e2e-against-service.
- Add `npm run test:watch` + `scripts/bootstrap.sh` (one-command fresh setup).
- **Agent:** `minimal-change-engineer`. **Gate:** fresh-clone
  `bootstrap && dev` works end-to-end.

## Phase 6 — Close

- Full verify: `tsc` + unit + Playwright + live smoke (chat + research flow).
- Update `AIO_PROJECT_STATE.md`, add R14 line to `docs/archive/CLOSED_PHASES.md`,
  `git mv` this checklist to `docs/archive/roadmap/` — **same session** (archive
  hygiene rule).

## Verification (per phase)

- Backend: `cd apps/web && npm run typecheck && npm test` (~3s typecheck).
- Frontend: stop `aio-app.service` → `npm run e2e` (relevant specs) → restart.
- Dev-env: fresh-clone dry-run of `bootstrap.sh`.
- Never mark a UI phase done on typecheck alone — live Playwright required.

## Sequencing & dependencies

```
Gate 0 ──► Phase 1 (test net) ──► Phase 2 (dedup) ──► Phase 3 (carve) ──┐
                                                                        ├──► Phase 6 (close)
                          Phase 4 (frontend) ──┬─────────────────────────┤
                          Phase 5 (dev-env)  ──┴─────────────────────────┘
```

Phase 4 and 5 are independent of the backend chain and may interleave between
backend phases. Gate 0, Phase 1, and Phase 3 gates are hard.
