# R7 Execution Checklist

Goal: Evidence-Driven Expansion. Per `AIO_MASTER_EXECUTION_PLAN.md`, no R7
feature starts without a one-page decision (user evidence, expected metric
impact, cost, risk, rollback). That evidence requires live beta usage, which
does not exist — R6.8's beta-gate items are still owner-gated and the product
has not launched beta users. R7 is proceeding anyway on direct, repeated
owner instruction ("xong r6 thì lên r7 đi, đừng dừng lại" — once R6 is done,
move to R7, don't stop), with the evidence gate explicitly waived and
documented rather than silently skipped. See
`docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md` "Evidence" section for the full
record of that override.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Current State

R7's first feature (Saved Agents) is engineering-complete and merged to
`main`. CI is green. The only remaining non-code item is the manual
dev-server walkthrough, gated on the owner migration push in
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`. No further R7 feature is
scoped yet.

## Saved Agents — done

One-pager: `docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md`.

A named, reusable instruction bundle a user can attach to a chat turn —
free-text instructions (appended after `GUARDRAIL_SYSTEM_PROMPT`/
`planInstructions`/`researchInstructions`, never before or in place of them)
plus a use-knowledge on/off toggle. Tool allowlisting, model override, and
sharing are explicitly deferred (no enforcement path; sharing is a non-goal).

Migration `0023` (`aio_saved_agents`, service-role only, RLS enabled), CRUD
in `apps/web/src/lib/aio/saved-agents/saved-agents.ts`, `/api/saved-agents`
(+`/[id]`) routes, composer picker (`SavedAgentMenu.tsx`), Settings tab
(`SavedAgentsPanel.tsx`). `npm run typecheck` clean, `npm run test:unit`
205/205 passing.

Manual dev-server verification (picker select/clear, settings round-trip,
knowledge-toggle-off skips context) is gated on the same remote-migration
push as R6.1/R6.5/R6.7 — see `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`.

## Exact Next Step

After the owner push of migrations `0020`-`0023`, run the Saved Agents
manual walkthrough and then update this checklist plus `AIO_PROJECT_STATE.md`
to mark that live gate closed. No further R7 feature has been scoped; this
checklist gains a new section if/when the next R7 feature starts.
