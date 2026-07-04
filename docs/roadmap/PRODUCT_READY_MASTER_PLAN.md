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

- [x] R10.1 Google Calendar connect flow — engineering + UI complete; blocked
      only on owner approval to push migrations to remote. See
      `R10_EXECUTION_CHECKLIST.md`.
- [x] R10.2 Proactive notifications — complete. See `R10_EXECUTION_CHECKLIST.md`.
- [ ] R6/R7 owner close-out items — see `OWNER_CLOSEOUT_CHECKLIST.md`

## Phase 1 — Observability & Safety Net

Owner: `sre-engineer`, `performance-benchmarker`. No blockers, can start
immediately.

- [x] Define SLOs for the 3 critical paths: chat response, research run,
      scheduled-job execution. Targets sized for Aio's actual current scale,
      not enterprise defaults. Done 2026-07-05 (`sre-engineer`). `docs/operations/SLO.md`
      already had chat SLOs (turn latency, Hermes accept, completion rate) —
      kept, but flagged as enterprise-shaped for a product with no metrics
      export yet. Research SLO = "completes within tier wall-clock timeout"
      (5/10/20min per plan tier, already enforced in `pricing.ts`). Scheduled-job
      SLO was **undefined** (SLO.md defers to a nonexistent "R4 pipeline SLO"
      doc) — proposed: ≥98% fire within grace window, ≤1% dead-letter rate,
      sized off the existing grace-window logic in `aio-schedule-contract.ts`.
- [x] Audit existing Langfuse/OTel coverage (R3/R8) against those SLOs —
      identify where a burning SLO would go unnoticed. Done 2026-07-05.
      **Critical gap: `otel-telemetry.ts` metrics export is a hardcoded no-op**
      ("Q7 scoped to spans only") — every `metrics.histogram`/`increment` call
      in `run-orchestrator.ts` silently discards data in prod. Per-request
      Langfuse traces work; aggregate/alertable numbers do not exist anywhere.
      Worse for scheduled jobs: `aio-job-worker-runtime.ts` has **zero**
      telemetry (console/journal only) — a crashed worker or silently missed
      schedule has no automated detection path today, only a user noticing
      their task didn't run. Highest-risk finding of this phase.
- [x] Establish a performance baseline: chat first-token latency, research
      run duration, Core Web Vitals on the chat/onboarding/settings UI. Done
      2026-07-05 (`performance-benchmarker`). Dev-mode CWV all well within
      target (LCP&lt;600ms, CLS&lt;0.02) but not representative of prod build.
      Chat first-token latency **cannot be measured — no such metric
      exists**; `CHAT_TURN_LATENCY_MS` only fires once at full-turn
      completion, no first-streamed-token histogram anywhere. Research run
      duration pulled from real historical run data (70-113s for
      research-style prompts). **🚨 Live issue found, not just an audit
      note: one real run (`66a29fab-ce6f-40e1-8914-c2fc73528361`) has been
      stuck in `status: running` since 2026-07-03T09:12:22Z — 45+ hours —
      and nothing in the supervisor/job-worker logs is catching it. This is
      the exact "burning SLO going unnoticed" scenario from the audit item
      above, happening live right now.** Needs a direct look (stuck-run
      sweep / crash-reconcile logic in `aio-hermes-supervisor`), separate
      from and higher priority than the rest of this hardening pass.
- [x] Design and run one local/staging load test scoped to realistic invite
      cohort traffic — never against production or billed third-party APIs
      without explicit confirmation. **Design done 2026-07-05, NOT
      executed** (per instruction). Two-part design: Part A (safe today, no
      billed calls) — k6 against `/api/conversations`, `/api/runs`,
      `/api/notifications`, `/api/preferences` + page loads, 10 concurrent
      VUs ramp, `p(95)&lt;800ms`/`fail rate&lt;1%` thresholds, run against a
      `next build && next start` staging instance only. Part B (real
      chat-turn load) is **blocked**: no mock-LLM path exists anywhere in
      the repo, so load-testing `/api/chat` for real would bill OpenRouter
      per request — needs a `MOCK_LLM=true` stub in
      `run-orchestrator.ts`/`hermes-client.ts` built first. k6/autocannon
      not currently installed (confirmed gap, not a reuse miss).
- [x] Cross-check against `OWNER_CLOSEOUT_CHECKLIST.md` item 5 (alert
      transport provisioning) — that item needs the owner to choose/wire a
      real paging channel; this phase defines what should page once wired.
      Done 2026-07-05 — `docs/operations/alert-routing.md` already fully
      specifies severity→channel routing and an SLO→runbook table; only
      needs the owner to point a real webhook at it. Caveat: won't actually
      page anything until the metrics-export gap above is fixed.
- [x] Cross-check against `OWNER_CLOSEOUT_CHECKLIST.md` item 6 (backup
      restore drill) — that item is owner-only (throwaway Supabase project);
      this phase can prepare the documented procedure but not execute it.
      Done 2026-07-05 — `docs/operations/backup-restore.md` already has a
      complete, execution-ready procedure; nothing left to draft.
- [x] Cost visibility: confirm OpenRouter per-customer spend caps (R8.5) and
      any other metered dependency have a visible current-spend view,
      not just a configured ceiling. Done 2026-07-05 — **gap confirmed**:
      `checkSpendCap`/`checkToolSubLimit` (`spend-cap.ts`) compute current
      spend server-side every turn but only surface it in the 402 error
      once the cap is already blown. No UI/API shows current spend
      proactively. Cheap fix: the data already exists, just needs a read
      endpoint + small settings-panel display.

## Phase 2 — Compliance & Trust Groundwork

Owner: `legal-compliance-checker`, `data-privacy-officer`,
`accessibility-auditor`. Required specifically because of the option-1 scope
decision — Aio must be able to flip to public without a compliance gap.

- [x] Verify whether ToS/privacy-policy acceptance is actually recorded
      (gated) at signup, not just linked. If not, add an acceptance record.
      Done 2026-07-05 (`legal-compliance-checker`) — **confirmed gap**: no
      `tos_accepted`/`accepted_at`/`policy_version` column anywhere in 30
      migrations; the only ToS/privacy links in the codebase are dead
      placeholders in an unrendered `Footer.tsx` (not imported anywhere).
      This matches `docs/legal/*` being explicitly marked "UNREVIEWED DRAFT,
      must not be linked yet" — so the missing link is deliberate, but the
      missing acceptance-*mechanism* is the real gap. Smallest fix: add
      nullable `tos_accepted_at`/`tos_version` to `hermes_registry` (same
      table as `onboarded_at`), wire from the onboarding POST, but leave the
      actual gate dark until legal review (below) finishes.
- [x] Data map: what personal data Aio currently collects/stores/processes,
      including R10.1's Google Calendar refresh token and any Discord
      tokens — confirm R6.5's export/delete flow actually covers all of it,
      including third-party token revocation on delete (not just DB-row
      removal). Done 2026-07-05 — **confirmed gap, Medium risk**: the
      Google Calendar *disconnect* route correctly calls `revokeGoogleToken()`
      against Google's real revoke endpoint (`google-calendar.ts:130`), but
      the full account-**delete** path (`account/delete.ts` →
      `deleteAccountAndData()`) never calls it — only cascades local DB rows.
      A deleted account leaves the Google OAuth grant live on Google's side
      indefinitely. Fix: call the same `revokeGoogleToken` helper from
      `deleteAccountAndData` before the storage/user cascade. Discord has no
      per-user OAuth token (bot-side only), so no equivalent gap there.
      Full `data-privacy-officer` data-map pass (done 2026-07-05) confirms
      and extends this: full table in Evidence Log, but the short version —
      account delete cascades DB rows correctly, but 3 things survive it
      that shouldn't: (a) the live Google OAuth grant (finding above), (b)
      platform bot tokens (Discord etc.) stored in a profile `.env` file,
      entirely outside Supabase, untouched by delete, (c) orphaned
      `vault.secrets` rows — only the `hermes_credential_refs` pointer row
      is cascaded, no `vault_delete_credential` RPC exists at all. Also:
      `google_calendar_connections` metadata missing from the export
      `TABLES` list (1-line fix), and Paddle-side deletion has no path from
      Aio at all (contract/DPA question, escalate to owner/legal, not an
      engineering fix).
- [x] Confirm breach-response readiness: is there a documented path if a
      credential/data leak happens (ties into Phase 1's alerting). Done
      2026-07-05 — **gap confirmed**: `docs/operations/incident-response.md`
      exists but only covers outage/data-loss/billing severity, with no
      breach classification, no notification timeline, no tie to a
      credential-leak scenario. Engineering can draft a detection→
      containment→scope runbook stub; notification-deadline thresholds
      (e.g. GDPR 72h) need `legal-compliance-checker`/owner to set — not an
      engineering default.
- [ ] Baseline WCAG 2.2 AA audit on 3 core flows: onboarding, chat, settings
      (including Scheduled Tasks / Connections modals). Report only — scope
      is a baseline pass, not a certification program. **Substantially
      already covered by the R11.5 accessibility-auditor pass** (2026-07-04,
      score 4.5/10 — see `R11_EXECUTION_CHECKLIST.md`/`R11_DONE.md`), not
      re-run here to avoid duplicate agent spend; R11.5b's focus-trap/aria-live
      fixes (in progress) directly address its Critical findings.
- [x] Cross-check against `OWNER_CLOSEOUT_CHECKLIST.md` item 4 (legal review
      of `docs/legal/*`) — that item needs qualified legal review and
      business-decision fill-ins (governing law, minimum age); this phase's
      ToS-enforcement finding feeds into what gets reviewed. Done 2026-07-05
      — item 4 correctly stays legal/business-scoped (governing law "not yet
      decided," no minimum-age clause exists at all); recommend extending
      its wording with one sub-bullet once docs clear review: "add
      signup-time acceptance gate (see finding above) before flipping
      public," rather than tracking it as a separate item.

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

- [x] Audit whether current analytics (R6.7) can answer: onboarding
      completion rate, first-week retention, feature adoption for Saved
      Agents (R7) and Connections (R10). Close the smallest real gap found.
      Done 2026-07-05 (`analytics-reporter`). First-week retention: **already
      answered** (`computeRetention()` in `weekly-metrics.ts` is live).
      Feature adoption: **code gap, not data gap** — `aio_saved_agents` and
      `google_calendar_connections` already have the timestamps needed, the
      weekly report just never queries them. Onboarding completion:
      partially answerable (registered→onboarded→activated funnel from
      existing `hermes_registry` timestamps), but step-level "where do they
      drop off" is structurally unanswerable since onboarding is a single
      screen with no steps to log. Smallest-gap fix identified (no new data
      collection, so no privacy review needed): add 2 queries/functions to
      `weekly-metrics.ts` for adoption counts + the registered/onboarded
      funnel, following the existing `activationCount()` pattern. Not
      implemented yet — small enough to hand to `backend-builder` directly
      when picked up.
- [ ] Evidence-based journey/friction analysis on onboarding → first chat →
      Scheduled Task/Connections, using existing analytics as the evidence
      base — no new user research without an explicit owner go-ahead
      (data-collection decision).
- [ ] Review in-app notification (R10.2) and error-state copy for product
      voice consistency (`product-ux-guardian` scope, not a new phase).

## Phase 5 — Strategic Direction (parallel track, non-blocking)

Owner: `trend-researcher`, `sprint-prioritizer`. Runs alongside all
engineering phases; never gates them.

- [x] Competitive/market landscape check for the next flagship bet after
      product-ready — build on the existing R10 research forks
      (`.claude/grill-logs/grill-log-next-flagship-phase-2026-07-02.md`)
      rather than re-deriving from scratch. Done 2026-07-05 (`trend-researcher`,
      no live web access, pre-cutoff knowledge only — flagged as lower
      confidence, needs a live WebSearch pass before the actual grill).
      Prior direction (Calendar connect + notifications) reconfirmed as
      correct. **Candidate for next grill-me round (not decided): Gmail
      connect** — direct sequel to R10.1, reuses the same OAuth/Vault
      infra, but gated on a CASA compliance/cost decision the owner has to
      make. Co-candidates: persistent cross-conversation memory (beyond
      R11's fact-memory tab), and confirming Discord notification toggle as
      a real consumer reachability surface vs. dev-only artifact.
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
