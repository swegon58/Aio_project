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
2. This master execution plan.
3. Current phase checklist, such as
   `docs/roadmap/R0_EXECUTION_CHECKLIST.md`.
4. `docs/roadmap/2026-06-28_aio_product_and_production_roadmap.md`.
5. Research report.

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

Known gaps that agents must not misreport as complete:

- no durable run/event/tool-call/approval tables
- no run repository layer
- approval state remains runtime/in-memory
- research stores only small conversation metadata, not plans/sources/reports
- knowledge ingestion runs synchronously in API request
- image generation estimates cost but does not reserve/settle credits
- scheduling proxies Hermes jobs but has no Aio-owned durable queue contract
- Paddle webhook handles only a partial event set and lacks an idempotency ledger
- Aio web has no telemetry module or evaluation corpus
- API-route, migration, Paddle webhook, and persistence integration tests are
  still missing

## Delivery Order

| Phase | Outcome | Depends on | Approval |
|---|---|---|---|
| R0 | CI and production safety baseline | None | Approved/in progress |
| R1 | Durable runs, replay, reconnect | R0 | Required |
| R2 | Tool governance and durable approvals | R1 | Required |
| R3 | Tracing, cost, SLOs, evaluations | R1 | Required |
| R4 | Durable Deep Research and Knowledge | R1-R3 | Required |
| R5 | Background workers and scheduled work | R1, R3 | Required |
| R6 | Commercial private beta readiness | R0-R5 | Required |
| R7 | Evidence-driven expansion | Beta evidence | Required per feature |

R2 and R3 may run in parallel using separate worktrees after R1 passes.

---

# R0: CI And Production Safety

**Goal:** make every later change verifiable and prevent development shortcuts
from reaching production.

Use the detailed execution contract:

- `docs/roadmap/R0_EXECUTION_CHECKLIST.md`

Required outputs:

- root CI for quality, security, database, and E2E
- focused unit and browser smoke tests
- no high/critical production dependency vulnerability
- secret scan with historical credential remediation
- production startup fail-closed behavior
- clean migration verification
- baseline chat/research/image measurements

Gate:

- clean checkout passes every CI job
- unsafe production configuration cannot start
- no unresolved live secret

---

# R1: Durable Run Foundation

**Goal:** every Aio run is durable, replayable, tenant-safe, and reconnectable.

## R1.1 Architecture Decision

Create:

- `docs/architecture/ADR-001-aio-run-ownership.md`

Decision must define:

- Aio run ID ownership
- Hermes run/session ID mapping
- run state machine
- event ordering and idempotency
- reconnect and replay semantics
- cancellation semantics
- retention boundary

Run states:

```text
queued -> running -> waiting_approval -> running
queued/running/waiting_approval -> cancelling -> cancelled
queued/running/waiting_approval -> failed
running -> completed
```

Acceptance:

- no state transition is implied only by UI state
- terminal states are immutable except administrative repair with audit

## R1.2 Versioned Event Contract

Create or refactor:

- `apps/web/src/lib/aio/runs/aio-run-events.ts`
- `apps/web/src/lib/aio/runs/aio-run-event-envelope.ts`
- `apps/web/src/lib/aio/runs/aio-run-event-schema.ts`
- `apps/web/src/lib/aio/hermes/hermes-event-mapper.ts`

Required envelope:

```ts
type AioRunEventEnvelopeV1 = {
  id: string;
  schemaVersion: 1;
  runId: string;
  threadId: string;
  sequence: number;
  type: AioRunEventType;
  occurredAt: string;
  receivedAt: string;
  source: "aio" | "hermes" | "worker";
  payload: unknown;
  hermes?: {
    runId?: string;
    eventId?: string;
  };
};
```

Rules:

- `(runId, sequence)` unique
- event ID globally unique
- payload typed by event type
- unknown Hermes events preserved as adapter diagnostics, not dropped silently
- secrets and large tool outputs redacted before persistence

Tests:

- every mapped event validates against V1
- duplicate Hermes event maps idempotently
- seconds/milliseconds timestamps normalize correctly
- unknown event behavior is explicit

## R1.3 Database Schema

Add ordered Supabase migrations for:

### `aio_runs`

- `id uuid primary key`
- `user_id uuid not null`
- `conversation_id uuid null`
- `thread_id text not null`
- `status text not null`
- `mode text not null`
- `input_summary text`
- `hermes_run_id text null`
- `hermes_session_id text null`
- `reserved_credits numeric`
- `actual_credits numeric`
- `error_code text null`
- `error_message_redacted text null`
- timestamps for created, started, updated, completed
- cancellation request timestamp
- metadata JSONB with size constraint

Indexes:

- `(user_id, created_at desc)`
- `(user_id, status, updated_at desc)`
- unique Hermes run ID when non-null
- conversation and thread lookup

### `aio_run_events`

- envelope fields above
- payload JSONB
- unique `(run_id, sequence)`
- unique event ID
- index `(run_id, sequence)`
- partition/retention decision documented before large scale

RLS:

- users read only their own runs/events
- browser cannot insert or mutate lifecycle rows directly
- service role writes through server repository
- cross-tenant tests mandatory

## R1.4 Server Repositories

Create:

- `apps/web/src/lib/aio/runs/run-repository.ts`
- `apps/web/src/lib/aio/runs/run-event-repository.ts`
- `apps/web/src/lib/aio/runs/run-state-machine.ts`

Required methods:

- create run
- attach Hermes identity
- append event transactionally and idempotently
- transition run state with allowed-transition validation
- mark terminal state
- request cancellation
- list user runs with cursor pagination
- fetch run plus ordered events

Rules:

- repositories are server-only
- no route contains raw lifecycle SQL
- append and state transition are transactional where required
- errors use stable internal codes

## R1.5 Split Chat Orchestration From Transport

Refactor the current chat route into:

- thin `apps/web/src/app/api/chat/route.ts`
- `apps/web/src/lib/aio/chat/run-orchestrator.ts`
- `apps/web/src/lib/aio/chat/chat-transport.ts`
- existing Hermes adapter modules

Orchestrator responsibilities:

- authenticate and resolve tenant/runtime context
- scan input
- reserve credits
- create Aio run before Hermes call
- build knowledge and personalization context
- start Hermes execution
- attach Hermes ID
- map, persist, and publish events
- settle/refund credits exactly once
- persist conversation linkage
- close run with stable outcome

Transport responsibilities:

- parse request
- convert UI messages
- expose AI SDK/SSE stream
- map internal errors to HTTP
- handle client disconnect without corrupting durable run state

## R1.6 Run APIs

Add:

- `GET /api/runs`
- `GET /api/runs/[runId]`
- `GET /api/runs/[runId]/events`
- `POST /api/runs/[runId]/stop`

Contracts:

- authenticated and tenant-scoped
- cursor pagination
- stable error schema
- event replay supports `afterSequence`
- stop endpoint idempotent
- OpenAPI 3.1 document under `docs/api/aio-runs.openapi.yaml`

## R1.7 Timeline Replay And Reconnect

Update:

- run timeline components under `apps/web/src/components/app/run-timeline`
- `apps/web/src/components/app/AppHome.tsx`
- run state hooks under `apps/web/src/lib` or `apps/web/src/hooks`

Behavior:

- create optimistic run shell after submit
- hydrate persisted history
- merge live events by ID/sequence without duplicates
- reconnect after refresh
- show running, waiting approval, completed, failed, cancelled
- stop control appears only for stoppable states
- loading/reconnect/error states do not erase existing events

UI rule:

- timeline communicates user outcomes; internal IDs/debug data remain hidden

## R1.8 R1 Tests

Add:

- schema/mapper unit tests
- repository integration tests against local Supabase
- state machine tests
- duplicate event tests
- cross-tenant RLS tests
- API contract tests
- browser refresh/reconnect Playwright test
- stop idempotency test

Gate:

- 100% new runs persisted
- one complete run replays after refresh
- duplicate event does not duplicate UI or billing
- cross-tenant read/write denied

---

# R2: Tool Governance And Durable Approvals

**Goal:** every sensitive action is predictable, reviewable, resumable, and
auditable.

## R2.1 Tool Inventory And Manifest

Inventory all Hermes tools, skills, browser actions, code execution, connected
apps, MCP tools, and media providers.

Create:

- `apps/web/src/lib/aio/tools/tool-manifest.ts`
- `apps/web/src/lib/aio/tools/tool-policy.ts`
- `docs/security/aio-tool-risk-register.md`

Manifest fields:

- canonical name and version
- display label/category
- owner
- input/output schema
- read/write/external side effects
- data classes accessed
- network scope
- timeout and retry policy
- risk: `safe | guarded | dangerous`
- approval policy
- redaction policy
- availability by plan

No public Tool Center UI in this phase.

## R2.2 Durable Tool Calls

Add `aio_tool_calls`:

- Aio and Hermes tool-call IDs
- run/user/tool identity
- manifest version
- lifecycle state
- redacted input/output
- risk and approval policy snapshot
- attempts, timeout, error code
- timestamps and idempotency key

Persist transitions:

```text
proposed -> waiting_approval -> approved -> running -> completed
proposed/waiting_approval -> denied/expired/cancelled
running -> failed/timed_out/cancelled
```

## R2.3 Durable Approvals

Add `aio_approvals`:

- approval ID, run, user, tool call
- status
- requested choice set
- selected decision
- policy snapshot
- expiry
- request and resolution timestamps
- actor and audit metadata

API:

- `GET /api/approvals/[approvalId]`
- `POST /api/approvals/[approvalId]/resolve`

Rules:

- resolve exactly once
- repeated same decision is idempotent
- conflicting second decision returns conflict
- expiry prevents execution
- resume token cannot be replayed
- `always` permission is deferred unless a scoped permission model exists

## R2.4 Approval UI

Build compact approval card/drawer:

- plain-English action summary
- target and changed data
- risk level without alarmist styling
- `Approve once`, `Deny`, and optional session scope
- expiry and resolved states
- no raw JSON by default

Timeline must show requested, approved/denied/expired, resumed, and final result.

## R2.5 Mandatory Policies

Approval required by default for:

- sending email/messages
- publishing content
- payment/purchase
- destructive file/database action
- external write
- shell command outside a constrained safe list
- deploy/infrastructure mutation
- credential creation/change

## R2.6 Audit Log And MCP Boundary

Add append-only audit records for:

- approval lifecycle
- credential changes/use
- admin actions
- dangerous tool execution
- MCP server enable/disable and calls

MCP requirements:

- allowlisted catalog
- tenant binding
- manifest version
- network and filesystem sandbox
- audit metadata
- no community server enabled directly in production

## R2.7 R2 Tests

- approval allow/deny/expire/replay
- dangerous tool cannot start without approval
- safe tool does not request unnecessary approval
- cross-tenant approval denied
- audit row emitted for every terminal path
- redaction tests
- resume exactly once

Gate:

- 100% dangerous calls use durable approval
- no approval decision can execute twice
- complete audit chain from run to tool to decision

---

# R3: Observability, Cost, SLOs, And Evaluations

**Goal:** identify why a run failed, slowed down, or became expensive before the
user reports it.

## R3.1 Telemetry ADR

Create:

- `docs/architecture/ADR-002-telemetry-and-retention.md`

Decide:

- OpenTelemetry SDK/exporter
- Langfuse adapter deployment
- PII/redaction boundary
- sampling
- trace/log/metric retention
- local development behavior
- provider outage fallback

No provider lock-in inside business logic.

## R3.2 Correlation Context

Propagate:

- request ID
- user/tenant ID as protected metadata
- conversation/thread ID
- Aio run ID
- Hermes run/session ID
- tool call and approval IDs
- billing reservation/settlement ID
- provider request ID

Never put raw prompt, secret, cookie, or auth header in span attributes.

## R3.3 Instrumentation

Instrument:

- request context and auth
- chat orchestration
- Hermes start/events/stop
- model calls
- tool calls and approvals
- knowledge retrieval/indexing
- image generation
- billing reserve/refund/settle
- queue and worker lifecycle

Measure:

- time to first visible response
- end-to-end run latency
- tool latency and retries
- provider/model tokens and cost
- queue wait
- approval wait
- success/failure by stable reason

## R3.4 SLOs And Alerts

Initial SLIs:

- chat turn success
- p95 first visible response
- long-run completion
- approval-resume success
- image generation success

Create:

- `docs/operations/SLO.md`
- alert routing and severity policy
- error-budget review cadence

Alerts must be actionable and linked to runbooks.

## R3.5 Internal Reliability And Cost View

Internal-only surface:

- success and failure trend
- provider/model/tool breakdown
- top failure reasons
- p50/p95 latency
- cost per successful outcome
- high-cost users/runs with privacy-safe identifiers

Do not expose an operations dashboard in consumer navigation.

## R3.6 Golden Evaluations

Create versioned fixtures for:

- normal chat
- planning
- Deep Research citation quality
- knowledge grounding
- memory behavior
- prompt injection
- dangerous-tool approval

Evaluation output:

- pass/fail and rubric score
- latency and cost
- model/provider/version
- prompt/config version
- regression against baseline

CI runs deterministic/unit checks. Scheduled jobs run costly model evals with a
budget cap.

## R3.7 Runbooks

Create runbooks for:

- provider outage
- Hermes unavailable/provisioning failed
- approval stuck
- knowledge job stuck
- billing drift
- browser session failure
- leaked/revoked secret
- abuse spike

Gate:

- failed run traceable from UI request to exact provider/tool/runtime cause
- cost attributable per run
- SLO dashboard and at least one synthetic check operational

---

# R4: Durable Deep Research And Knowledge

**Goal:** make Deep Research a consumer workflow worth returning and paying for.

## R4.1 Research Product Contract

Define:

- supported question types
- output format
- source quality rules
- citation coverage requirement
- max duration/search count/cost
- cancel/retry behavior
- partial-result behavior

Modes remain in composer:

- Auto
- Plan
- Research

Do not create a separate technical console.

## R4.2 Durable Research Model

Add:

- research metadata on `aio_runs`
- `aio_research_sources`
- `aio_research_claims` or report-section citation mapping
- artifact linkage

Source fields:

- canonical URL
- title/publisher
- retrieved timestamp
- snippet/metadata
- source type
- dedupe key
- citation position
- retrieval/tool provenance

## R4.3 Research Orchestration

Implement durable stages:

```text
understand -> plan -> discover -> inspect -> synthesize -> verify -> report
```

Each stage emits persisted progress events. Retry only idempotent stages.
Cancellation produces a useful partial report when possible.

Use Hermes planner/executor. Learn patterns from Onyx/OpenManus; do not fork
their runtime into Aio.

## R4.4 Research Workspace UI

Main conversation remains central.

Required UI:

- compact research progress frame inside conversation
- checklist of stages with active/completed/failed states
- search/source count and elapsed time
- stop control
- report rendered as normal assistant output
- citations linked at claim level
- sources panel available without covering the report
- export report to Markdown/PDF after completion

Avoid:

- repeated action buttons on every card
- nested cards
- developer logs
- technical agent-role labels

## R4.5 Knowledge Center Pipeline

Complete:

```text
upload -> validate -> store -> parse -> chunk -> embed -> index
       -> ready/failed -> retrieve -> cite
```

Data:

- source
- document
- parse/index job
- chunks/embeddings
- citation/provenance

Requirements:

- tenant RLS
- supported MIME/size limits
- malware/content-type validation
- idempotent ingestion
- progress and retry
- deletion removes derived data
- retrieval result includes source identity

## R4.6 Knowledge UI

Consumer-facing:

- upload/drop files
- status: processing, ready, failed
- retry/delete
- search/filter
- source details
- citations open exact source where possible

Defer broad enterprise connector catalog. Start with files and a small approved
set of high-value sources.

## R4.7 Research And Knowledge Quality

Tests:

- source dedupe
- citation maps to source
- unsupported claims detected by eval rubric
- failed retrieval still produces honest response
- ingestion retry/idempotency
- cross-tenant source access denied
- report replay after refresh
- responsive UI and keyboard access

Metrics:

- report completion
- citation coverage
- source open rate
- knowledge retrieval success
- cost per completed report
- repeat research usage

Gate:

- research survives refresh/reconnect
- report claims have inspectable sources
- knowledge deletion and tenant isolation verified

---

# R5: Background Workers And Scheduled Work

**Goal:** remove long-running work from request lifetimes and make scheduled
tasks reliable.

## R5.1 Queue ADR

Create:

- `docs/architecture/ADR-003-queue-and-worker-runtime.md`

Compare:

- Redis/BullMQ
- Postgres-backed queue
- managed queue compatible with TypeScript and Python workers

Decision criteria:

- retries and delayed jobs
- deduplication
- observability
- local development
- hosted cost
- TS/Python interoperability
- operational burden

No queue technology is locked before this ADR is approved.

## R5.2 Job Contract

Versioned envelope:

- job ID/type/version
- tenant and run IDs
- idempotency key
- attempt/max attempts
- schedule/deadline
- redacted payload reference
- correlation context

State:

```text
queued -> claimed -> running -> completed
queued/claimed/running -> retrying -> queued
queued/running -> cancelled/dead_lettered/failed
```

## R5.3 Worker Services

Add independent workers for:

- knowledge ingestion
- long research stages
- browser tasks
- approval expiry
- scheduled tasks
- retention/cleanup

Workers must:

- use service identity
- enforce tenant context
- heartbeat/lease
- handle graceful shutdown
- be idempotent
- emit run events and traces
- never rely on browser cookies

## R5.4 Scheduled Tasks

Keep Scheduled Tasks in left navigation.

Build:

- list/create/edit/pause/delete
- plain-language schedule builder
- timezone
- next run
- last outcome
- approval policy
- notification destination
- execution history

Backend:

- schedule table
- scheduler producer
- idempotent occurrence key
- missed-run policy
- concurrency policy

## R5.5 Failure And Recovery

- exponential retry with caps
- dead-letter view for internal support
- user-visible actionable failure
- stop/cancel propagation
- no duplicate billing on retry
- no duplicate external action after timeout uncertainty

## R5.6 R5 Tests

- duplicate enqueue
- worker crash and lease recovery
- retry exhaustion
- scheduled occurrence exactly once
- cancellation
- no duplicate billing/action
- queue outage behavior

Gate:

- browser/research/ingestion can outlive web request safely
- scheduled task executes once per occurrence
- worker failure is observable and recoverable

---

# R6: Commercial Private Beta Readiness

**Goal:** safely invite real users, charge correctly, support them, and learn
from usage.

## R6.1 Onboarding

First-run setup:

- basic personalization
- model/provider state
- privacy and data-use summary
- skip option where safe

First screen:

- usable composer
- Research, document summary, and safe browser-assisted examples
- no marketing landing page inside app
- one sample run or clear empty state

Activation event:

- first successful meaningful run, not account creation

## R6.2 Auth And Tenant Security Audit

- Supabase Auth session paths
- RLS on every tenant table
- service-role use server-only
- CSRF/origin checks for mutations
- rate limits for chat, upload, approvals, auth, image, webhook
- account deletion/export
- session/device management
- admin access audit

Add automated cross-tenant tests for every new table/API.

## R6.3 Billing And Credits

Complete Paddle integration:

- checkout
- customer/subscription mapping
- webhook signature validation
- idempotent webhook storage
- plan entitlement reconciliation
- cancellation/past-due handling
- top-up purchase
- refund/chargeback handling

Add append-only ledgers:

- provider billing event
- credit grant
- reservation
- settlement
- refund/adjustment

Rules:

- no development billing fallback in production
- money/provider quantities use integer minor units or exact decimal
- duplicate webhook cannot double-credit
- every run settlement reconciles to ledger

## R6.4 Usage And Plan UX

Show:

- current plan
- credits remaining
- reset date
- clear upgrade/manage action
- estimated cost before unusually expensive work
- budget stop reason without internal pricing jargon

## R6.5 Privacy, Legal, And Data Controls

Publish:

- Terms
- Privacy Policy
- Acceptable Use Policy
- retention policy
- subprocessors/provider disclosure
- content/evaluation training policy

Product controls:

- export account data
- delete account/data
- delete knowledge source and derived content
- configurable retention where promised

Legal text requires qualified review before public launch.

## R6.6 Deployment And Operations

Control plane:

- production domain/TLS
- managed secrets
- migration promotion
- preview and production environments
- post-deploy smoke
- rollback procedure

Execution plane:

- worker/runtime health
- sandbox limits
- autoscaling/concurrency caps
- browser session limits
- deploy/rollback independent from web

Operations:

- backups and restore test
- incident severity/contact
- status page
- support intake
- release checklist
- dependency/security cadence

## R6.7 Beta Analytics

Weekly:

- activation
- D1/W1 retention
- successful runs per active user
- run/research/image success
- first response and completion p95
- approval accept/reject/expiry
- cost per successful outcome
- citation/source interaction
- top failure categories

Privacy-safe analytics only; no raw private prompt dashboard.

## R6.8 Beta Gate

Required:

- onboarding and first run pass
- billing sandbox end-to-end pass
- webhook replay pass
- tenant security tests pass
- data export/deletion pass
- legal pages reviewed
- SLO/alerts/runbooks active
- backup restore exercised
- support owner assigned
- limited invite cohort and spend cap configured

---

# R7: Evidence-Driven Expansion

**Goal:** add complexity only when beta data proves value.

No R7 feature starts without a one-page decision containing user evidence,
expected metric impact, cost, risk, and rollback.

## Candidate: Saved Agents

Trigger:

- repeated manual customization or repeated task patterns

Build:

- saved instruction/config
- allowed tools
- knowledge scope
- model preference
- sharing remains deferred

Do not expose arbitrary system prompts or unsafe tool combinations.

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
