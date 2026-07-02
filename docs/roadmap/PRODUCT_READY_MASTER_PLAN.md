# Product-Ready Master Plan

Trigger: owner request, 2026-07-02 (Discord) — assemble a full specialist
roster and a single long checklist covering everything needed to bring Aio
to product-ready across every aspect (engineering, reliability, compliance,
UX, strategy), organized so work stays trackable and resumable.

## Scope Decision (owner grill, 2026-07-02)

Question asked: what does "product ready" mean as a launch target right now?
**Owner answered Option 1** — harden Aio to "could flip to public anytime":
do the compliance/reliability/legal groundwork now (ToS enforcement,
baseline accessibility, load testing, backup/DR, cost visibility), but do
**not** build a public marketing/pricing site or i18n yet. Stay invite-only
in practice until a separate go/no-go decision later.

This locks scope for every phase below:

**In scope now:** SRE ownership (SLOs/observability/alerting), performance
baselining/load testing, baseline WCAG AA on core flows, ToS enforcement at
signup, data privacy/DSR completeness (incl. R10's Google token), backup/DR
drill, cost visibility, docs, onboarding/activation analytics, UX/journey
research on existing flows, strategic/market research (parallel track).

**Explicitly deferred (not in this plan):** public marketing/pricing site,
i18n/l10n, full legal a11y certification program, public self-serve billing
beyond what already exists, multi-jurisdiction compliance program.

## How This Plan Relates To Other Docs

- `docs/roadmap/R10_EXECUTION_CHECKLIST.md` — R10.1 (Google Calendar
  connect) / R10.2 (proactive notifications) is separate, already-approved,
  in-flight work. This plan does not duplicate it; Phase 2 below references
  R10.1's privacy/ToS implications, nothing else.
- `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` — the 6 remaining R6/R7
  owner-only actions (Paddle sandbox, legal review, alert transport, backup
  drill, manual product checks, OpenRouter provisioning key) overlap
  directly with Phase 1/2 below. Where they overlap, this plan points to
  that checklist instead of restating it.
- `AIO_PROJECT_STATE.md` — remains the highest-level source of truth; update
  it whenever a phase below completes, per its own Update Contract.

## Agent Roster For This Plan

Existing roster used where applicable: `hermes-architect`, `appsec-engineer`,
`backend-builder`, `frontend-builder`, `product-ux-guardian`, `kimo`,
`qa-reviewer`, `reality-checker`.

10 new specialists imported from the `agency-agents` repo
(`msitarzewski/agency-agents`) into `.claude/agents/`, selected specifically
for the gaps this plan closes:

| Agent | Owns |
|---|---|
| `sre-engineer` | SLOs, observability, alerting, capacity |
| `performance-benchmarker` | Load testing, Core Web Vitals baseline |
| `accessibility-auditor` | Baseline WCAG 2.2 AA on core flows |
| `technical-writer` | Runbook/doc accuracy and gaps |
| `data-privacy-officer` | Data mapping, DSR/export-delete completeness, breach readiness |
| `legal-compliance-checker` | ToS enforcement, vendor compliance posture |
| `analytics-reporter` | Onboarding/activation/retention metrics |
| `ux-researcher` | Journey/friction analysis on existing flows, evidence-based |
| `sprint-prioritizer` | Re-sequencing this plan as it grows, dependency mapping |
| `trend-researcher` | Parallel strategic/market research track |

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Phase 0 — Already In Flight (reference only, not owned by this plan)

- [~] R10.1 Google Calendar connect flow — see `R10_EXECUTION_CHECKLIST.md`
- [ ] R10.2 Proactive notifications — see `R10_EXECUTION_CHECKLIST.md`
- [ ] R6/R7 owner close-out items — see `OWNER_CLOSEOUT_CHECKLIST.md`

## Phase 1 — Observability & Safety Net

Owner: `sre-engineer`, `performance-benchmarker`. No blockers, can start
immediately.

- [ ] Define SLOs for the 3 critical paths: chat response, research run,
      scheduled-job execution. Targets sized for Aio's actual current scale,
      not enterprise defaults.
- [ ] Audit existing Langfuse/OTel coverage (R3/R8) against those SLOs —
      identify where a burning SLO would go unnoticed.
- [ ] Establish a performance baseline: chat first-token latency, research
      run duration, Core Web Vitals on the chat/onboarding/settings UI.
- [ ] Design and run one local/staging load test scoped to realistic invite
      cohort traffic — never against production or billed third-party APIs
      without explicit confirmation.
- [ ] Cross-check against `OWNER_CLOSEOUT_CHECKLIST.md` item 5 (alert
      transport provisioning) — that item needs the owner to choose/wire a
      real paging channel; this phase defines what should page once wired.
- [ ] Cross-check against `OWNER_CLOSEOUT_CHECKLIST.md` item 6 (backup
      restore drill) — that item is owner-only (throwaway Supabase project);
      this phase can prepare the documented procedure but not execute it.
- [ ] Cost visibility: confirm OpenRouter per-customer spend caps (R8.5) and
      any other metered dependency have a visible current-spend view,
      not just a configured ceiling.

## Phase 2 — Compliance & Trust Groundwork

Owner: `legal-compliance-checker`, `data-privacy-officer`,
`accessibility-auditor`. Required specifically because of the option-1 scope
decision — Aio must be able to flip to public without a compliance gap.

- [ ] Verify whether ToS/privacy-policy acceptance is actually recorded
      (gated) at signup, not just linked. If not, add an acceptance record.
- [ ] Data map: what personal data Aio currently collects/stores/processes,
      including R10.1's Google Calendar refresh token and any Discord
      tokens — confirm R6.5's export/delete flow actually covers all of it,
      including third-party token revocation on delete (not just DB-row
      removal).
- [ ] Confirm breach-response readiness: is there a documented path if a
      credential/data leak happens (ties into Phase 1's alerting).
- [ ] Baseline WCAG 2.2 AA audit on 3 core flows: onboarding, chat, settings
      (including Scheduled Tasks / Connections modals). Report only — scope
      is a baseline pass, not a certification program.
- [ ] Cross-check against `OWNER_CLOSEOUT_CHECKLIST.md` item 4 (legal review
      of `docs/legal/*`) — that item needs qualified legal review and
      business-decision fill-ins (governing law, minimum age); this phase's
      ToS-enforcement finding feeds into what gets reviewed.

## Phase 3 — Reliability & Performance Validation

Owner: `performance-benchmarker`, `sre-engineer`, `qa-reviewer`. Depends on
Phase 1's baseline existing first.

- [ ] Run the designed load test, capture bottlenecks, prioritize fixes.
- [ ] Cross-browser/responsive pass on core flows (existing `qa-reviewer`
      scope, extended to cover the same 3 core flows as Phase 2's a11y
      audit for shared evidence).
- [ ] Verify graceful degradation: what a user sees when a scheduled job,
      research run, or third-party provider (OpenRouter/Google) fails
      mid-flight — not just the happy path.

## Phase 4 — Product Depth & Retention

Owner: `analytics-reporter`, `ux-researcher`, `product-ux-guardian`. Can run
in parallel with Phase 1-3 once R6.7 analytics baseline is confirmed working.

- [ ] Audit whether current analytics (R6.7) can answer: onboarding
      completion rate, first-week retention, feature adoption for Saved
      Agents (R7) and Connections (R10). Close the smallest real gap found.
- [ ] Evidence-based journey/friction analysis on onboarding → first chat →
      Scheduled Task/Connections, using existing analytics as the evidence
      base — no new user research without an explicit owner go-ahead
      (data-collection decision).
- [ ] Review in-app notification (R10.2) and error-state copy for product
      voice consistency (`product-ux-guardian` scope, not a new phase).

## Phase 5 — Strategic Direction (parallel track, non-blocking)

Owner: `trend-researcher`, `sprint-prioritizer`. Runs alongside all
engineering phases; never gates them.

- [ ] Competitive/market landscape check for the next flagship bet after
      product-ready — build on the existing R10 research forks
      (`.claude/grill-logs/grill-log-next-flagship-phase-2026-07-02.md`)
      rather than re-deriving from scratch.
- [ ] Once Phases 1-4 produce a long combined item list, run one
      `sprint-prioritizer` pass to re-sequence by dependency/impact and flag
      anything that looks like a scope decision for a future grill round.

## Explicitly Out Of Scope For This Plan

Per the option-1 scope decision: public marketing/pricing site, i18n/l10n,
full accessibility certification program, public self-serve billing beyond
what exists today, multi-jurisdiction compliance program. Revisit only via
an explicit new owner decision.

## Working Convention

- Each phase's findings get folded directly into this file's checklist
  items (mirrors how R10's team review was folded into
  `R10_EXECUTION_CHECKLIST.md`) — no separate untracked findings docs.
- Anything a specialist agent flags as a business/strategy decision (not an
  engineering call) goes through `grill-me`, one question at a time, batched
  per round — do not silently decide scope.
- Update `AIO_PROJECT_STATE.md` whenever a phase completes, per its Update
  Contract.
