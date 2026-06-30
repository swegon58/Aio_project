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

- Branch: `feat/r5-r7-delivery-line` (R5, R6, R7 share this branch per owner
  override).
- First and only R7 feature so far: **Saved Agents**.

## Saved Agents

One-pager: `docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md`.

Scope: a named, reusable instruction bundle a user can attach to a chat turn
— free-text instructions addition (appended after
`GUARDRAIL_SYSTEM_PROMPT`/`planInstructions`/`researchInstructions`, never
before or in place of them) plus a use-knowledge on/off toggle. Tool
allowlisting, model override, and sharing are explicitly deferred — no real
enforcement path exists for the first two, and sharing is a non-goal per the
master plan.

- [x] Migration `0023` — `aio_saved_agents` table, service-role only, RLS
      enabled, no end-user policies bypassing ownership
      (`apps/web/supabase/migrations/0023_aio_saved_agents.sql`)
- [x] `apps/web/src/lib/aio/saved-agents/saved-agents.ts` — `SavedAgent`
      type, `validateSavedAgentInput` (pure: name required/trimmed/<=80
      chars, instructions <=4000 chars), and `listSavedAgents` /
      `getSavedAgent` / `createSavedAgent` / `updateSavedAgent` /
      `deleteSavedAgent` (Supabase-backed, scoped to the calling user)
- [x] `/api/saved-agents` (GET list, POST create) and
      `/api/saved-agents/[id]` (PATCH update, DELETE) routes
- [x] Wired into the chat send path: `savedAgentId` flows through the
      request body into `OrchestratorInput`; resolved saved-agent
      instructions are appended to the existing instructions array
      (`[GUARDRAIL_SYSTEM_PROMPT, planInstructions, researchInstructions,
      savedAgentInstructions, knowledgeContext]`, `.filter(Boolean).join(" ")`)
      — `GUARDRAIL_SYSTEM_PROMPT` stays first and is never reachable from
      saved-agent text; `useKnowledge: false` skips `buildKnowledgeContext`
      for that turn
- [x] Composer UI: `SavedAgentMenu.tsx` — dropdown picker in the composer
      toolbar (mirrors `ChatModeMenu.tsx`'s trigger/popover pattern), wired
      into `AppHome.tsx`'s primary `sendMessage` call via
      `activeSavedAgentId` state; renders nothing when the user has no saved
      agents yet
- [x] Settings UI: `SavedAgentsPanel.tsx` — self-contained create/edit/delete
      panel (own `/api/saved-agents` fetches, no prop-drilling through
      `SettingsModal.tsx`), new "Saved Agents" tab in `SettingsModal.tsx`
      between Knowledge and Plan
- [x] Unit tests: `saved-agents.test.ts` — `validateSavedAgentInput` covering
      empty/whitespace name, name over/at the 80-char boundary, instructions
      over 4000 chars, and valid input. (The CRUD functions all require a
      `SupabaseClient`; no DB-mock pattern exists yet in this test suite —
      same scoping precedent as `invite-gate.test.ts`/`spend-cap.test.ts`,
      which also test only their pure functions.)
- [x] `npm run typecheck` clean
- [x] `npm run test:unit` — 205/205 passing (5 new)
- [ ] Manual dev-server verification (composer picker selects/clears, "None"
      reverts to default behavior, Settings tab create/edit/delete round-trips,
      knowledge-toggle-off turn skips knowledge context) — **gated**: same
      remote-migration-push gate as R6.1/R6.5/R6.7 (migration `0023` not yet
      pushed to `xeuvoaedwdmuhxdcoxcx.supabase.co`; no CLI access token in
      this environment). Owner must run
      `npx supabase link --project-ref xeuvoaedwdmuhxdcoxcx && npx supabase db push`
      before this can be exercised live.

## Exact Next Step

Saved Agents is code-complete and unit-verified
(`npm run typecheck` clean, `npm run test:unit` 205/205 passing). The only
open item is the manual dev-server walkthrough, blocked on the same
remote-migration-push gate already open for R6.1/R6.3/R6.5/R6.7 — pushing
migrations `0020`-`0023` together would close all of those live-verification
gates in one owner action. No further R7 feature has been scoped; per the
standing instruction this checklist will gain a new section if/when the next
R7 feature starts. For the short owner-side close-out list, use
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`.
