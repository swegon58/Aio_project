# R7 one-pager: Saved Agents

**Owner:** `@swegon58`
**Date:** 2026-06-30
**Status:** approved to build (owner-directed pre-beta override — see "Evidence" below)

## What

A "saved agent" is a named, reusable bundle a user can attach to a chat turn:

- **Instructions addition** — free text appended to the existing prompt join
  (`[GUARDRAIL_SYSTEM_PROMPT, planInstructions, researchInstructions,
  knowledgeContext]`) as one more array element. It is **additive only** —
  it can never replace or precede `GUARDRAIL_SYSTEM_PROMPT`, which is always
  first and non-negotiable.
- **Use knowledge (on/off)** — toggles whether `buildKnowledgeContext` runs
  for turns using this saved agent. No per-thread/per-source scoping exists
  in the codebase today, so this is the only knowledge control that is
  honest to ship.

**Explicitly not in this version:**

- **Tool allowlisting per saved agent.** The only existing tool-allow
  mechanism (`disabled_toolsets`) is baked into the Hermes profile's
  `config.yaml` at process-spawn time (`provision.ts`), not passed per
  request. Building a per-saved-agent toolset selector today would mean
  either (a) a client-side label with no real enforcement — i.e. a fake
  safety control — or (b) extending the Hermes run-start API, a deeper
  change into `apps/harness/hermes-agent` out of scope for this pass. Per
  the master plan's "do not expose ... unsafe tool combinations," shipping
  an unenforced toggle is worse than shipping none — deferred.
- **Model preference per saved agent.** Model selection is purely
  server-side, plan-tier-determined (`pricing.ts` → `provision.ts`); there
  is no override path anywhere in the orchestrator. No UI lever exists to
  attach a preference to in good faith — deferred.
- **Sharing.** Per the master plan's explicit non-goal for this feature.

This scope keeps every shipped control backed by a real enforcement path,
which is the same bar the rest of R6 held to (e.g. spend-cap, invite-gate).

## Evidence

The master plan's R7 rule: *"No R7 feature starts without a one-page
decision containing user evidence, expected metric impact, cost, risk, and
rollback."* Saved Agents' own trigger condition is *"repeated manual
customization or repeated task patterns"* — that requires live beta usage
data, which does not exist; the product has not launched beta users yet
(R6.8 owner-gated items are still open).

This document is being written **without that evidence**, on direct,
repeated owner instruction ("xong r6 thì lên r7 đi, đừng dừng lại" — move to
R7 once R6 is done, don't stop) issued in this session, after I flagged the
evidence-gate conflict and the owner chose to proceed anyway. No usage data
is fabricated here or anywhere else in this document — this paragraph is
the substitute for it, by explicit owner authority to override the
plan's own internal gate (separate from the standing R6→R7 *ordering*
approval already recorded in `AIO_PROJECT_STATE.md`, which only authorized
sequence, not skipping the evidence requirement).

## Expected metric impact

No measured baseline exists pre-beta. Qualitative expectation only: reduces
repeated manual prompt-prefixing for users with a recurring task pattern
(e.g. "always answer as a terse code reviewer," "always skip the disclaimer
paragraph"). If/when beta usage data exists, the metric to watch is repeat
usage of a saved agent across turns/sessions (a proxy for retained value) —
not yet instrumented; can reuse the `aio_runs.metadata` pattern already
used for `planMode`/`mode` tracking.

## Cost

- One migration (new table, service-role only, RLS enabled, no new
  external dependency).
- Additive wiring at existing seams (`OrchestratorInput`, the instructions
  array, the request body) — no restructuring.
- One new Settings tab + one composer menu item — both follow existing UI
  patterns (`SettingsModal` tabs, composer `+` menu items).
- No new infra, no new paid service, no new background worker.

## Risk

- **Prompt injection via saved instructions.** Mitigated structurally:
  `GUARDRAIL_SYSTEM_PROMPT` is always prepended first and is never
  user-editable; a saved agent can only append text after it, same trust
  boundary as the existing `planInstructions`/`researchInstructions`
  strings.
- **Scope creep into "unsafe tool combinations."** Mitigated by deferring
  tool allowlisting entirely (see "What," above) rather than shipping an
  unenforced control.
- **Stale/abandoned saved agents.** Low — user-owned rows, user deletes
  them like any other owned resource (knowledge files, schedules).

## Rollback

Pure additive feature behind its own table and an optional `savedAgentId`
request field that defaults to absent (no saved agent → identical behavior
to today). Rollback is: stop reading `savedAgentId` server-side (one-line
revert) and/or drop the UI entry points. No migration down needed beyond
the standard `drop table if exists aio_saved_agents` if the table itself
must be removed.
