# R15 Execution Checklist — Plan/Research Rebuild + Streaming + Panel Cleanup

**Status:** A/B/C/D/E + E1–E13 ✅ SHIPPED. Only **E14** pending (owner
approval). This file is **compressed** (2026-07-13, 502→~55 lines) — R17 is
now the active checklist; this stays open only for E14 + the uncommitted-work
pointer. Full pre-compression detail in git history
(`git log -- docs/roadmap/R15_EXECUTION_CHECKLIST.md`).

## Shipped (one line each — detail in git history)

- **A** — streaming jitter fix: sticky-bottom autoscroll + `behavior:"auto"`
  (`AppHome.tsx`); A-followup added `MessageRow`/`React.memo` custom
  comparator + `firstUserText` `useMemo` hoist + `experimental_throttle:50`.
- **B** — "Current Run" + "Today" panel cards removed (`RightPanel`,
  `MessageList`, `AppHome`, `app-home-utils`, `app-home-types`); shared run
  infra (`useRunTimeline`, `/api/runs/*`) kept.
- **C** — plan + research rebuilt: unified grill→summary→HITL-approve→run,
  `aio-questions` batch block, `PlanWizard.tsx` (Next/Back), `usePlanFlow`
  rewrite, `aio_approvals` reuse, `isFinalPlanShape()` positive-shape gate
  fix (6-agent grill). tsc clean, `plan-wizard.spec.ts` 4/4.
- **D** — STATE/README/CLAUDE.md sync; zero deer-flow contamination.
- **E1–E13** — Discord UI backlog: vision wiring fix (E2, real 2-layer bug),
  image-bubble sizing, glass material, icon-rail text-leak/hover/WIP fixes,
  font picker, terminal Code/Preview tab fix + card unification, light-mode
  shadow, E13 terminal margin + dark-theme shadow restore. tsc clean,
  348/348 unit, Playwright green. **E13 NOT live-verified** (Chrome ext
  unavailable all session).

## E14 — Design-ops proposal (PENDING owner approval) ⏳

Owner's E13 follow-up: piecemeal shadow/margin fixes (E1–E13) signal the UI
needs one unified design layer, not per-card patches. **Nothing executed —
proposal only, awaiting explicit approve/adjust in a new session.**

Grounded in what exists (no new tooling): 18 agency-agents imported (kimo,
product-ux-guardian, accessibility-auditor, ux-researcher, frontend-builder,
qa-reviewer, reality-checker); `apps/web:impeccable` skill installed;
`agent-pipeline` skill dispatches build→critique→fix→QA→reality-check; stack
= shadcn/ui + Tailwind + Radix.

Real gaps: no `DESIGN.md` (token system/elevation/spacing only in scattered
CSS comments — root cause of E11/E13's shadow back-and-forth); `impeccable
hooks` installed but not enabled in `.claude/settings.json`; `mockup/` dir
name is debt (holds production CSS).

**Proposed "do first" list (owner review only):**
1. `/impeccable document` → generate `DESIGN.md` from existing code.
2. `/impeccable hooks on` → auto-flag token regressions at edit time.
3. Token-file change rule in `agent-pipeline` SKILL.md (token edits route
   through design-system check).
4. Rename `mockup.css`/`mockup/` → `design-system.css`/`ui/`.

Owner said "Ghi vào plan đi, tôi qua session mới làm." Next session presents
this list for approve/adjust before touching any of the 4 items.

## Uncommitted working tree (NOT attributed to an R15 sub-item)

Beyond E13's staged CSS: `git status` shows image-gen provider migrated
Kie.ai→fal.ai (`api/images/generate/route.ts` → `fal-client.ts`, needs
`FAL_API_KEY`), plus mobile/UX touches across several files not re-verified
this pass. **Run `git status`/`git diff` before assuming content.** R17's
T1#0 step owns the commit-or-stash decision for these before the R16→main
push.

## Closeout (when E14 resolved)

- [ ] E14 approved → execute the 4 items, then close R15 fully.
- [ ] Full close: `git mv` this file to `docs/archive/roadmap/`, add 1 line
      to `docs/archive/CLOSED_PHASES.md`, trim STATE (same session).
