# Aio Master Execution Plan

**Status:** Active execution contract
**Product owner:** User
**Implementation owner:** Main coding agent
**Created:** 2026-06-28
**Primary input:** `/home/swegon/Downloads/deep-research-report-for-aio.md`
**Integrated branch:** `main` at merge commit `1a21077`

This is the complete implementation plan from the current alpha to a
production-ready consumer private beta. It translates the research report into
code, data, UI, test, security, operations, and release tasks.

## How Any Coding Agent Must Use This Plan

1. Read this file first.
2. Read the phase-specific checklist before editing.
3. Confirm the current branch and worktree.
4. Work on one approved phase and one bounded task at a time.
5. Do not begin a later phase because an earlier phase looks easy to skip.
6. Do not merge, force-push, rotate credentials, choose paid infrastructure, or
   change product scope without product-owner approval.
7. Update task status only after its acceptance commands pass.
8. End each task with changed files, verification evidence, risks, and exact
   next task.

## Source Of Truth

Use documents in this order:

1. Product-owner decisions in the latest conversation.
2. `AIO_PROJECT_STATE.md` for current location, phase, and progress.
3. This master execution plan.
4. Current phase checklist, such as
   `docs/roadmap/R0_EXECUTION_CHECKLIST.md`.
5. `docs/roadmap/2026-06-28_aio_product_and_production_roadmap.md`.
6. Research report.

The research report is input, not automatic authority. This plan deliberately
rejects or defers recommendations that conflict with Aio's chosen direction.

## Fixed Product Decisions

- Aio is a consumer product, not a developer or operations console.
- Keep one visible default Aio agent.
- Keep Next.js as product/control plane.
- Keep Hermes as execution/runtime plane.
- Make complex work understandable through plans, progress, approvals, sources,
  artifacts, and history.
- Deep Research is the next flagship workflow.
- Keep Postgres/pgvector until measured retrieval evidence requires another
  vector store.
- MCP is an internal governed integration boundary, not an unrestricted public
  tool marketplace.
- Agent Builder, visual workflow canvas, and visible multi-agent teams are
  deferred until post-beta usage proves demand.
- User-facing UI text must be English.
- Every phase requires product-owner approval before implementation begins.

## Target Architecture

```text
Browser
  -> Next.js UI and API control plane
     -> Supabase Auth, Postgres, RLS, Storage
     -> Aio run orchestration
     -> billing, policy, approvals, knowledge, telemetry
     -> queue producer
        -> Hermes execution workers
        -> browser/code sandbox workers
        -> knowledge ingestion workers
        -> scheduled-task workers
     -> model and media provider adapters
```

Ownership rules:

- Aio owns product run IDs, tenant policy, billing, approvals, persistence, and
  user-visible state.
- Hermes owns execution internals and emits runtime events.
- Hermes IDs remain adapter metadata, never the primary product identity.
- Postgres is source of truth for durable product state.
- SSE is live transport; persisted events are replay source of truth.
- Provider SDKs remain behind Aio adapters.

## Current Code Anchors

Agents must extend these existing surfaces before creating alternatives:

- Chat entry and orchestration:
  `apps/web/src/app/api/chat/route.ts`
- Chat request/runtime-message helpers:
  `apps/web/src/lib/aio/chat/chat-route-handler.ts`
- Hermes client and stream parser:
  `apps/web/src/lib/aio/hermes/hermes-client.ts`,
  `apps/web/src/lib/aio/hermes/hermes-stream.ts`
- Product event contract, mapper, and writer:
  `apps/web/src/lib/aio/runs/aio-run-events.ts`,
  `apps/web/src/lib/aio/hermes/hermes-event-mapper.ts`,
  `apps/web/src/lib/aio/runs/run-event-writer.ts`
- Timeline UI:
  `apps/web/src/components/app/run-timeline/`
- Current live approval proxy and UI:
  `apps/web/src/app/api/chat/approval/route.ts`,
  `apps/web/src/components/app/run-timeline/ApprovalCard.tsx`,
  `AppHome.handleApprovalRespond`
- Runtime context/provisioning:
  `apps/web/src/lib/hermes/request-context.ts`,
  `apps/web/src/lib/hermes/provision.ts`,
  `apps/web/src/lib/hermes/lifecycle.ts`
- Hermes gateway execution/approval/stop surface:
  `apps/harness/hermes-agent/gateway/platforms/api_server.py`,
  `apps/harness/hermes-agent/tools/approval.py`
- Current migrations:
  `apps/web/supabase/migrations/0001_*.sql` through `0008_*.sql`
- Knowledge upload, embedding, retrieval:
  `apps/web/src/app/api/knowledge/route.ts`,
  `apps/web/src/lib/hermes/knowledge.ts`,
  `apps/web/src/lib/aio/knowledge/retrieve-context.ts`
- Research mode and progress:
  `apps/web/src/lib/aio/chat/research-mode.ts`,
  `apps/web/src/components/app/ResearchProgressCard.tsx`
- Image generation and Gallery:
  `apps/web/src/app/api/images/generate/route.ts`,
  `apps/web/src/lib/aio/images/kie-client.ts`,
  `apps/web/src/lib/aio/images/image-storage.ts`,
  `apps/web/src/app/api/gallery/route.ts`
- Scheduling:
  `apps/web/src/app/api/cron/`,
  `apps/harness/hermes-agent/cron/`
- Billing:
  `apps/web/src/lib/billing/payment-provider.ts`,
  `apps/web/src/app/api/billing/checkout/route.ts`,
  `apps/web/src/app/api/billing/webhook/route.ts`,
  `apps/web/src/lib/hermes/billing.ts`
- Auth and Settings:
  `apps/web/src/app/login/`,
  `apps/web/src/app/auth/callback/route.ts`,
  `apps/web/src/lib/supabase/middleware.ts`,
  `apps/web/src/components/app/SettingsModal.tsx`
- Existing browser and unit tests:
  `apps/web/e2e/app-smoke.spec.ts`,
  mapper, event adapter, pricing, production guard, and threat-pattern tests

All gaps once listed here (durable run/event/tool-call/approval tables, run
repository, in-memory approval state, synchronous knowledge ingestion, no
telemetry module, missing integration tests, etc.) were closed by R1-R6,
below. If a future agent suspects one has regressed, verify against the
current code at the anchors above rather than trusting old notes.

## Delivery Order

| Phase | Outcome | Status |
|---|---|---|
| R0 | CI and production safety baseline | Closed |
| R1 | Durable runs, replay, reconnect | Merged |
| R2 | Tool governance and durable approvals | Merged |
| R3 | Tracing, cost, SLOs, evaluations | Merged |
| R4 | Durable Deep Research and Knowledge | Merged |
| R5 | Background workers and scheduled work | Merged |
| R6 | Commercial private beta readiness | Merged |
| R7 | Evidence-driven expansion | Saved Agents merged; other candidates pending evidence trigger |

---

All of R0-R6 below are **closed/merged on `main`**. Kept only as a compact
index of what was built and where its gate/evidence lives — the original
line-by-line build spec is no longer needed day-to-day; if deep historical
detail is ever required, it's in git history and each phase's own
`docs/roadmap/R*_EXECUTION_CHECKLIST.md`.

# R0: CI And Production Safety — closed

Root CI (quality/security/DB/E2E), secret-scan closure, production fail-closed
startup, clean migrations. Gate: clean checkout passes every CI job, no
unresolved live secret. Detail: `docs/roadmap/R0_EXECUTION_CHECKLIST.md`.

---

# R1: Durable Run Foundation — merged

Durable `aio_runs`/`aio_run_events` (versioned envelope, RLS, idempotent
append), server-only run repositories, chat orchestration split from
transport, `GET/POST /api/runs*`, timeline replay/reconnect. Gate: runs persist
and replay after refresh, no cross-tenant leakage, no duplicate billing on
duplicate event. ADR: `docs/architecture/ADR-001-aio-run-ownership.md`.

---

# R2: Tool Governance And Durable Approvals — merged

Tool manifest/policy + risk register, durable `aio_tool_calls`/`aio_approvals`
with exactly-once resolve, approval UI (plain-English, `Approve once`/`Deny`),
mandatory-approval policy list (email, payments, destructive/external writes,
shell, infra, credentials), append-only audit log, MCP allowlist/sandbox
boundary. Gate: 100% dangerous calls gated by durable approval, no double
execution, full audit chain.

---

# R3: Observability, Cost, SLOs, And Evaluations — merged

OTel/Langfuse telemetry (ADR-002), correlation context propagated end to end,
instrumentation across chat/Hermes/tools/billing/queue, SLOs + alert routing
(`docs/operations/SLO.md`), internal-only cost/reliability view, golden eval
fixtures, runbooks for outage/stuck-job/billing-drift/leaked-secret/abuse.
Gate: failed run traceable to exact cause, cost attributable per run, at least
one synthetic SLO check live.

---

# R4: Durable Deep Research And Knowledge — merged

Research product contract (Auto/Plan/Research modes, no separate console),
durable research model (`aio_research_sources` + claim/citation mapping),
7-stage durable orchestration (`understand→plan→discover→inspect→synthesize→
verify→report`), in-conversation research progress UI + MD/PDF export +
sources panel, full knowledge pipeline (upload→validate→parse→chunk→embed→
index→retrieve→cite) with tenant RLS and idempotent ingestion. Gate: research
survives refresh, every claim has an inspectable source, knowledge deletion +
tenant isolation verified. (R9 later extended this — see R9 in
`AIO_PROJECT_STATE.md`.)

---

# R5: Background Workers And Scheduled Work — merged

Queue ADR-003, versioned job contract/state machine, independent workers
(knowledge ingestion, research stages, browser tasks, approval expiry,
scheduled tasks, retention), Scheduled Tasks UI (plain-language builder,
timezone, history, notification destination — closed by R10.2), exponential
retry + dead-letter + cancel propagation. Gate: long-running work outlives the
web request safely, one execution per scheduled occurrence, worker failure is
observable/recoverable.

---

# R6: Commercial Private Beta Readiness — merged

Onboarding + activation event, full auth/tenant security audit (RLS, CSRF,
rate limits, export/delete, session mgmt), complete Paddle billing (webhook
idempotency, append-only ledgers, no dev fallback in prod), plan/usage UX,
published legal pages + data export/delete controls, deployment/ops runbooks
+ backup-restore drill, weekly beta analytics. Gate: onboarding + billing
sandbox + tenant-security + data export/delete all pass, legal reviewed,
SLOs/alerts live, backup restore exercised, invite cohort + spend cap set.

---

# R7: Evidence-Driven Expansion

**Goal:** add complexity only when beta data proves value.

No R7 feature starts without a one-page decision containing user evidence,
expected metric impact, cost, risk, and rollback.

## Candidate: Saved Agents — merged

Built: saved instruction/config, allowed tools, knowledge scope, model
preference. Sharing remains deferred. No arbitrary system prompts or unsafe
tool combinations exposed.

## Candidate: Visual Workflow Builder

Trigger:

- substantial users create repeated multi-step routines that cannot be served by
  templates/schedules

Build only after durable run/job contracts exist. Learn UI packaging from
Dify/Flowise; do not replace Aio architecture.

## Candidate: Internal Specialist Agents

Trigger:

- evals show one-agent planner consistently underperforms on separable domains

Prefer manager-as-tool internally. Do not expose agent teams unless users gain
clear control or understanding.

## Candidate: Qdrant

Trigger:

- measured pgvector bottleneck or unmet hybrid retrieval quality

Require benchmark with same corpus, filters, latency, recall, tenant isolation,
cost, and migration/rollback plan.

## Candidate: Production Browser Provider

Trigger:

- browser-assisted workflow validates demand and local Playwright isolation or
  observability becomes insufficient

Compare Browserbase, Stagehand, and browser runtime options against session
recording, live view, isolation, region, cost, and recovery.

## Candidate: Multimodal Expansion

Image generation exists first. Video/audio/document creation requires:

- provider adapter
- cost estimate and budget guard
- async job lifecycle
- artifact persistence
- moderation/safety
- cancellation/refund behavior
- gallery/library UX

Gate:

- feature improves a chosen product metric without violating SLO or unit
  economics

---

# Cross-Cutting Frontend Standard

Every phase must preserve:

- clean consumer UI
- English user-facing copy
- responsive desktop/mobile layout
- stable icon positions and hover expansion
- no background dots visible through menus, chat bubbles, cards, bars, or
  dialogs; surfaces use at least the approved opaque treatment
- no duplicate Settings controls
- no redundant right-panel modules
- no nested cards
- no technical implementation instructions shown in product UI
- no backend/provider/runtime leakage in consumer UI: never reveal model
  names, raw tool/runtime names, internal cost plumbing, webhook/system terms,
  or other implementation-facing metadata unless the surface is explicitly an
  owner/admin/internal screen
- user-facing status copy describes user intent or outcome, not the hidden
  backend mechanism
- interactive controls use a shared Aio action pattern per surface; avoid
  ad-hoc button treatments that drift from the approved visual language
- accessible names, keyboard navigation, focus, contrast
- text fits containers without overlap
- consistent typography hierarchy
- loading, empty, error, disabled, retry, cancel, and success states

Required review:

- Playwright screenshots desktop/mobile
- interaction test
- overflow check
- dark/light mode
- reduced motion where animation exists

# Cross-Cutting Backend Standard

- tenant context explicit
- server-only privileged clients
- idempotency for external writes and webhooks
- stable error codes
- timeouts/retries/cancellation
- input size and schema validation
- no secret in logs/events/database payload
- transaction boundaries documented
- provider adapter, not provider logic inside route/UI
- migration forward path and rollback note
- observable correlation IDs
- cost and quota enforcement

# Cross-Cutting Security Standard

- no committed credentials
- managed production secrets
- RLS and cross-tenant tests
- least privilege
- approval for dangerous actions
- sandbox browser/code/MCP
- rate limiting and abuse detection
- audit trail
- dependency/secret scans
- data export/deletion
- incident and credential-rotation runbooks

# Branch And Review Protocol

For each phase:

1. Create a dedicated worktree/branch from latest approved `main`.
2. Add a phase checklist with exact file ownership and tests.
3. Product owner approves scope.
4. Implement small vertical slices.
5. Main agent integrates and verifies.
6. Read-only reviewer audits security/regression.
7. Push branch and provide live Aio URL.
8. Product owner reviews.
9. Merge only after explicit approval.

Suggested branches:

- `feat/r0-ci-production-safety`
- `feat/r1-durable-runs`
- `feat/r2-tool-governance`
- `feat/r3-observability-evals`
- `feat/r4-deep-research-knowledge`
- `feat/r5-workers-schedules`
- `feat/r6-private-beta`

# Team-Agent Assignment

- Main agent: architecture, integration, shared files, final tests, Git.
- Schema worker: migrations/repositories only.
- API worker: bounded routes/services only after schema contract is frozen.
- UI worker: bounded components/styles only after API/event contract is frozen.
- Test worker: independent fixtures/tests, no production edits unless assigned.
- Reviewer: read-only, severity plus file/line.
- UI product reviewer: read-only review for consumer-safe copy, hidden backend
  details, control consistency, state clarity, and visual cohesion.

Rules:

- no overlapping write sets
- shared lockfiles/workflows owned by main agent
- secrets never delegated
- main agent reviews all output
- one agent does not mark its own feature accepted

# Token And Context Efficiency

- Use LeanCTX for verbose reads/build/test output.
- Keep one phase checklist as durable handoff.
- Load full source only before editing; use map/signature views for exploration.
- Delegate bounded codebase maps, not vague research.
- Do not rerun a passing expensive test until relevant files change.
- Record decisions and failures in phase checklist.
- Keep provider/live tests to a small representative sample with budget caps.

# Definition Of Done For The Whole Program

Aio private beta is complete only when:

- runs persist, replay, reconnect, and cancel
- dangerous tools require durable approval
- every run has trace, outcome, cost, and stable failure reason
- Deep Research produces durable reports with inspectable citations
- knowledge ingestion/retrieval is tenant-safe and recoverable
- long work runs outside request lifetime
- scheduled tasks execute once and show history
- billing and credits reconcile exactly
- onboarding reaches first successful run
- privacy/export/deletion/legal controls exist
- SLOs, alerts, backups, runbooks, and support are active
- CI/security/migrations/E2E pass from clean checkout
- product owner approves private beta release

# Explicitly Deferred

- visible multi-agent teams
- unrestricted MCP marketplace
- visual workflow canvas
- Qdrant without benchmark evidence
- enterprise single-tenant deployment
- public sharing/agent marketplace
- broad connector catalog
- autonomous external writes without approval
