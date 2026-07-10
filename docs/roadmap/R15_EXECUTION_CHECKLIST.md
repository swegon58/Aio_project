# R15 Execution Checklist — Plan/Research Rebuild + Streaming + Panel Cleanup

**Status:** in progress (2026-07-10). Branch `r15-plan-research-rebuild` from
`main` (`5961baa`). Scope locked by owner 2026-07-10. Zero deer-flow
contamination — this phase touches `apps/web` + `apps/harness` of this repo only.

## Goal

Four workstreams, one branch, shipped incrementally with a live verify loop each:

- **A. Streaming jitter fix** — chat token stream became choppy; restore smooth render.
- **B. Remove "Current Run" + "Today" cards** — panel cards (not tabs), felt redundant.
- **C. Plan + Research mode rebuild** — multi-question grill (Next/Back), one summary
  message, HITL approval gate, then run. Unified UX for both modes.
- **D. Docs/state sync** — state, README, CLAUDE.md reflect post-R15 reality.

## Decisions (locked 2026-07-10)

1. **Question generation:** batch — backend emits ALL clarifying questions (2-5) in one
   `aio-questions` block. Frontend wizard shows Next/Back, answers editable before submit.
2. **Approval gate:** reuse existing HITL approval infra (`aio_approvals`,
   `/api/chat/approval`). Plan message gets Approve / Edit / Cancel.
3. **Research scope:** same grill + summary + approve flow as plan; after approve, runs
   the research pipeline (web tools, sources, progress).

## Status Key

- `[x]` done + verified (tsc + lint + Playwright live)
- `[~]` in progress / partially done
- `[ ]` not started

---

## B — Remove "Current Run" + "Today" cards  (smallest, do first)

Note: these are **panel cards in RightPanel**, not tabs. Backend `/api/runs/*`,
`run-repository/api/client`, `RunTimeline`, `useRunTimeline` are **shared run
infrastructure** (approvals, events, stop, lifecycle) and MUST stay. Only the
visible cards + their frontend wiring go.

- [x] **B1.** Delete `apps/web/src/components/app/app-home/sections/CurrentRunCard.tsx`
- [x] **B2.** Delete `apps/web/src/components/app/app-home/sections/TodayCard.tsx`
- [x] **B3.** Edit `RightPanel.tsx` — remove `<CurrentRunCard />` + Today section (+ their 15 props)
- [x] **B4.** Edit `MessageList.tsx` — remove mobile today strip
- [x] **B5.** Edit `AppHome.tsx` — remove `handleTodayAction`/`activeTodayCards`/TODAY_CARDS import/currentRun* derived + prop drilling
- [x] **B6.** Edit `app-home-utils.ts` — remove `TODAY_CARDS` constant
- [x] **B7.** Edit `app-home-types.ts` — remove `TodayAction`, `TodayCard` types
- [x] **B8.** `useRunTimeline.ts` left as-is — shared run infra (approvals/events/stop) MUST stay; no CurrentRunCard-only props were found that required dropping (kept RunTimeline for HITL approval surface)
- [x] **B9.** Verify: tsc clean, app-smoke 4/4 green (currentRun DOM assertions removed + obsolete stop-card test deleted)

## A — Streaming jitter fix

Root cause found: the autoscroll `useEffect` (`AppHome.tsx`) fired
`scrollIntoView({behavior:"smooth"})` on **every token** and ignored scroll
position — the smooth animation fought content growth every frame. That is the
"ko mượt như ban đầu" regression. (The full-list re-render / per-message regex
re-parse the audit flagged is pre-existing structural cost, not a regression —
deferred to A-followup below, only if long-conversation lag is observed.)

- [x] **A4.** Autoscroll: sticky-bottom (scroll only if user within 120px of
      bottom — no yanking while reading history) + `behavior:"auto"` (instant,
      no smooth-animation thrash). `AppHome.tsx` autoscroll `useEffect`.
- [x] **A5.** Verify: tsc clean, app-smoke 4/4 green.
- [ ] **A-followup (deferred):** extract `<MessageItem>` + `React.memo` + `useMemo`
      for splitMessageSegments/parsePlanQuestion, IF real lag shows up on long
      conversations. Requires stabilizing ~6 handlers (useCallback) for memo to
      bite — non-trivial blast radius, not justified without a measured symptom.

## C — Plan + Research rebuild  (largest)

Shared flow for both modes: toggle mode → submit → backend emits batch questions →
wizard (Next/Back) → summary message → plan → approve gate → run.

### C.be — Backend protocol

- [ ] **C1.** `plan-mode.ts` — replace "ask ONE question per turn" with "emit ALL questions
      (2-5) in one fenced `aio-questions` block: `{questions:[{question,choices[],recommended}]}`"
- [ ] **C2.** `research-mode.ts` — same batch-question instruction
- [ ] **C3.** `run-orchestrator.ts` — after summary message, keep tools disabled; emit plan;
      wire an approval gate so execution only starts after Approve
- [ ] **C4.** Decide transport for batch block (reuse `aio-question` SSE path, plural shape)

### C.fe — Frontend wizard + approval

- [ ] **C5.** `app-home-utils.ts` — add `parsePlanQuestions` (plural); parse `aio-questions` block
- [ ] **C6.** New `PlanWizard.tsx` — step indicator (Q i/N), question card, choices + Other,
      Next/Back, local answer state (editable), Review step
- [ ] **C7.** `usePlanFlow.ts` rewrite — collect answers → send ONE summary message → await plan →
      render Approve/Edit/Cancel via approval infra
- [ ] **C8.** `Composer.tsx` — wire wizard in place of single-question auto-send (`Composer.tsx:158-200`)
- [ ] **C9.** Research mode: reuse wizard; after Approve, run-orchestrator enables research tools
- [ ] **C10.** Verify: Playwright live — plan mode: submit task → answer 3 Qs via Next/Back → edit
      one → submit summary → plan appears → Approve → run executes. Repeat for research mode.

## D — Docs / state sync

- [ ] **D1.** `AIO_PROJECT_STATE.md` — add R15 in-progress section; trim if stale
- [ ] **D2.** `README.md` / `CLAUDE.md` — point active checklist at R15 (no current-run/today refs exist today)
- [ ] **D3.** Confirm zero `deer-flow` / `deerflow` references introduced in any R15 change

## Open notes

- C may surface scale (backend protocol change + new wizard + approval wiring ×2 modes).
  Build the lazy correct version first; if C blows up, split into C.fe / C.be sub-commits
  still on this branch. Report rather than silently scope-cut.
- Each workstream commits independently. Verify (tsc + lint + Playwright) before marking done.
