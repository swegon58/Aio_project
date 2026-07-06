# Future Candidate — Multi-Runtime Control Plane (DeerFlow / Onyx / OpenHands)

Status: **not approved, filed for later**. Do not start engineering work from
this file. Revisit trigger is below.

## What this is

On 2026-07-03 the owner shared a deep-research report (full text:
`2026-07-03_multi_runtime_deep_research_report.md`, same folder) proposing
Aio evolve from "one product with one execution runtime (Hermes)" into a
**control plane** that can route a task to whichever specialist engine suits
it best:

- **DeerFlow** (ByteDance, MIT) — a research/report/slide-deck engine. Would
  sit next to Hermes for deep-research-style tasks.
- **Onyx** (Apache) — a RAG/knowledge-search backend. Would sit underneath
  both Hermes and DeerFlow as a shared "company knowledge" source, not a
  replacement for either.
- **OpenHands** (MIT) — an autonomous coding-agent engine. Would only get
  used if/when Aio needs to let the agent write and ship code changes on a
  user's behalf.

The report includes a full adapter-pattern blueprint (`RuntimeAdapter`
interface, unified `AioRunEvent` event stream, DB schema, Docker/K8s
layout, a P0-P3 rollout gantt starting 2026-07-10).

## Decision (grill, 2026-07-03, Discord)

Owner picked, across a 5-question grill:

1. **Defer.** File this as a future direction; keep building the already
   -approved work (R10 Google Calendar connect + notifications, and the
   Product-Ready Master Plan hardening phases). Do not start any of this now.
2. **Fact-check before filing** — done, see "Fact-check" below. The numbers
   hold up; this is not a reason to distrust the report's direction.
3. **File it properly** — this document plus the raw report copy, both in
   `docs/roadmap/`, so it doesn't get lost in a Discord thread.
4. **Revisit trigger:** after the Product-Ready Master Plan's **Phase 1
   (Observability & Safety Net)** is done — see
   `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md`. Not before, and not "whenever
   it comes up" — there is a concrete checkpoint.
5. **Onyx (RAG backend) is bundled into the same decision**, not evaluated
   separately, even though it already has its own research worktree
   (`Aio_project_onyx_openmanus_lab`). One revisit conversation, not three.

## Fact-check (2026-07-03)

The report's GitHub star counts were flagged as implausible before checking
(a 208k-star niche agent project sounded like a hallucination). Independent
web search confirms they broadly hold up as of 2026-07:

- Hermes Agent (NousResearch/hermes-agent): ~190k+ stars (star-history.com
  ranks it #25 globally) — genuinely one of the fastest-growing OSS agent
  projects, not a fabricated number.
- DeerFlow (bytedance/deer-flow): ~66k+ stars, #1 GitHub Trending in
  Feb 2026 at launch.
- Onyx (onyx-dot-app/onyx): ~30.6k stars.
- OpenHands (OpenHands/OpenHands, formerly All-Hands-AI): ~65-70k stars.

Conclusion: the report's numbers are not the problem. The reason to defer is
**timing and priority**, not data quality — see "Why deferred" below.

## Why deferred (not rejected)

- R10.1 (Google Calendar connect) hasn't started, and the Product-Ready
  Master Plan (5-phase hardening: observability, compliance/legal,
  reliability, retention, strategic direction) hasn't started any phase
  either. Both were already committed before this report arrived.
- DeerFlow's own documentation says it's built for a trusted local network —
  no auth, no RBAC, no billing, no multi-tenant isolation. Bolting it onto
  Aio (a multi-customer product) means absorbing a large new security build
  at the exact moment Aio is trying to close *existing* security debt
  (e.g. the plaintext refresh-token posture already tracked in
  `R10_EXECUTION_CHECKLIST.md`).
- `CLAUDE.md` currently states Hermes as **the** execution/runtime plane
  (singular). Moving to a plural, multi-runtime model is a real architecture
  reversal — worth doing deliberately later, not as a side effect of an
  unplanned report.
- The single idea worth keeping regardless of timing: the report's
  `RuntimeAdapter` / `AioRunEvent` interface design (unifying different
  engines' events into one shape the UI understands) is a clean pattern —
  reuse it as a starting sketch if/when this gets picked back up, rather
  than redesigning from scratch.

## When this gets revisited

After Product-Ready Phase 1 lands, re-open this file and re-ask:

1. Does Aio's own Deep Research pipeline (R9, already shipped and polished)
   still fall short of what DeerFlow offers, enough to justify running two
   research engines?
2. Has DeerFlow shipped any multi-tenant/auth story in the meantime (check
   its changelog — this was a hard blocker as of 2026-07)?
3. Is there real user demand for a coding-agent engine (OpenHands) yet, or is
   that still speculative?
