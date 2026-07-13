# R17 Candidate Plan — Product Gap Closure + Competitive Ideas

**Status:** draft, not locked. Synthesized 2026-07-13 from 3 parallel research
passes (ux-researcher, product-ux-guardian, general-purpose competitor
research) requested by owner. Goes through `grill-me` next, then owner picks
scope before this becomes a real execution checklist.

## Why this exists

Owner asked: review R16 (done — see `R16_EXECUTION_CHECKLIST.md`, committed
`db97a5c`), then delegate to the internal agency to simulate real user usage,
compare against Aio's current gaps, and separately research what users
commonly ask for + what smaller competitors do well. This file merges all
three findings into one ranked, actionable plan.

## Research provenance

- **ux-researcher**: traced 8 realistic consumer scenarios against the live
  code (`AppHome.tsx`, `app-home/{hooks,sections}`, `SettingsModal.tsx`,
  `ScheduledTasksModal.tsx`, `OnboardingOverlay.tsx`). All findings
  code-observed, file:line cited.
- **product-ux-guardian**: audited consumer-safety of copy/state-clarity
  across `SettingsModal.tsx`, `useConnections.ts`, `ToolCallCard.tsx`,
  `tool-metadata-constants.ts`, `IconRail.tsx`, plus cross-checked the
  unmerged R16 worktree for a real merge-conflict risk.
- **general-purpose (web research)**: commonly-requested AI-agent features
  (memory persistence, real autonomy, transparency/intervention points, cost
  transparency) + 8 niche competitors beyond Emergent/Manus (Genspark,
  Flowith, Fellou, Perplexity Comet, ChatGPT Atlas, Skyvern, Ninja AI, Dia),
  each with a stealable UI/feature idea. Sources cited inline in the
  agent's report (this session's transcript).

**Two independent internal agents converged on the same #1 bug** —
`useConnections.ts`'s save/remove copy ("Saved/Removed. Restart the gateway
for it to take effect.") is an ops concept leaking into consumer UI, with no
UI element anywhere consuming `restartRequired` — a real dead end, not just
awkward copy. Treat this as the highest-confidence finding in this doc.

---

## Tier 1 — fast, high-confidence fixes (bug-class, days not weeks)

1. **Fix "restart the gateway" dead-end.** `useConnections.ts:142,166`,
   `api/connections/token/route.ts:61,106`. Either wire an auto-restart on
   token save, or replace the copy with an honest async-pending status (R16's
   own Linear precedent: "Added — sign-in still needed" instead of a fake
   "Connected"). Found independently twice — highest confidence item here.
2. **Merge/reconcile the R16 worktree before it rots further.** The R16
   `SettingsModal.tsx` still has `plan`/`credentials`/`skills` tabs that
   `main`'s `r15-plan-research-rebuild` branch already deleted (2026-07-11/12,
   "redundant" cleanup) — these will conflict on merge, and R16's actual
   consumer-value UI (skill marketplace, honest Linear/n8n connect status) is
   currently live for zero users despite being marked "shipped." This is
   time-sensitive: the longer both branches move independently, the worse the
   merge gets.
3. **Wire the dead `notificationsUnread` signal into `IconRail.tsx`.**
   Backend signal already threaded through `FloatingChrome.tsx` — just never
   rendered. Cheapest fix in this list; closes the known "no bell icon" gap
   for async/scheduled-task completions.
4. **Fix Composer's "Edit image" entry.** `Composer.tsx:429-440` — labeled
   "New" but `disabled`, while a working edit path already exists via
   clicking an existing generated image's reference chip
   (`useImageGeneration.ts`). Either wire the menu entry to the real path or
   remove the misleading "New" tag until it's built.

## Tier 2 — product-completeness gaps (need a scoped UI pass, ~1-2 weeks, sequence after Tier 1 merge)

5. **Memory visibility UI.** Backend (`memorySnapshot.facts/.summary`) is
   fully wired but `MemoryFactsPanel.tsx` was cut from Settings nav
   (2026-07-11) with no replacement. This is simultaneously the #1
   externally-requested AI-agent feature (persistent memory, per competitor
   research) and a trust gap: onboarding tells users "Aio stores your chats
   ... to answer you" but gives no way to inspect/edit/delete what's stored.
6. **Restore a consumer-safe path to plan/billing status and provider
   credentials.** `plan`/`credentials` tabs were removed as "redundant" with
   zero replacement CTA anywhere in `AppHome.tsx`/`FloatingChrome.tsx`. A
   paying subscriber currently has no self-serve way to check their tier or
   add a personal provider key. Track as its own gate, not folded silently
   into the earlier cleanup.
7. **Natural-language scheduling input.** `aio-schedule-contract.ts` only
   accepts duration/cron/ISO-timestamp syntax; the placeholder itself
   ("e.g. every 30m, 0 9 * * 1-5") assumes cron literacy. Add basic
   NL-to-schedule parsing ("every day at 9am") for the consumer-facing entry
   point; keep cron as power-user fallback.
8. **De-jargon the tool-run timeline.** `ToolCallCard.tsx` /
   `tool-metadata-constants.ts` render internal names straight to users:
   "MCP Integrations", "Research Depth Gate", "Terminal Sandbox". Replace
   with task-outcome language ("Checking research depth", "Running code").
9. **Connected Apps scope.** Today's `platforms.ts` only covers chat-bot
   tokens (Telegram/Discord/Slack/etc.) with the same gateway-restart copy
   bug as #1. R16's Tier A (once merged per #2) already replaces most of
   this surface with the honest Linear/n8n connect flow — re-verify this
   item's remaining scope after the merge lands, likely shrinks to just the
   chat-platform rows.

## Tier 3 — competitive-differentiation bets (bigger scope, owner prioritization needed)

Ranked by the research agent's actionable×differentiated score:

10. **Editable plan-before-run + typed step blocks** (Fellou/Skyvern
    pattern) — biggest lever against the most common complaint in the
    market ("fake autonomy, no transparency"). Render Hermes run steps as
    typed, inspectable blocks the user can review/edit before execution.
11. **Live cost/credit burn-down meter** — cheap relative to its trust
    payoff; Genspark/Fellou get punished hard in reviews for opaque credit
    burn.
12. **Two-speed mode toggle** (quick chat vs. deep autonomous run, Ninja AI
    pattern) — maps directly onto Aio's existing chat vs. Deep Research
    split; make the effort/cost tradeoff an explicit control.
13. **Citation-anchored research output** (Perplexity Comet pattern) — every
    claim in a Deep Research report links to its source; reinforces Aio's
    "Deep Research is the flagship" positioning and fixes a category-wide
    weak spot (even OpenAI's own Deep Research export has open bug reports).
14. **Reusable Skills as saved one-click recipes** (Dia pattern) — natural
    fit once R16's skill marketplace is merged and live; makes repeat
    workflows sticky.

## Explicitly out of scope / unchanged

- Firecrawl+Exa paid API keys, Tier C browser-automation appsec review —
  still hard-gated on owner approval per R16's locked decisions, untouched
  by this doc.
- Google Calendar OAuth consent screen — pre-existing owner-side gate
  (`AIO_PROJECT_STATE.md`), re-surfaced by ux-researcher's scenario trace,
  not new.

## Suggested sequencing

Tier 1 first (small, high-confidence, unblocks real usage of already-built
R16 work). Tier 2 next, scoped as its own mini-phase after the R16 merge
lands so #6/#9 aren't re-litigated against stale tab structure. Tier 3 is a
separate owner-prioritization conversation — these are bigger bets, not bugs,
and should compete against whatever else is on the roadmap rather than being
auto-sequenced here.
