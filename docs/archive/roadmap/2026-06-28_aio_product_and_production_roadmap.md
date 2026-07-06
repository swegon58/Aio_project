# Aio Product and Production Roadmap

**Status:** Proposed

**Reviewed:** 2026-06-28

Input: `deep-research-report-for-aio.md` and the current Aio repository

## Purpose

This is the canonical execution roadmap for taking Aio from a strong local
agent product to a reliable consumer beta. It filters the research against
what the repository already contains and the product direction already chosen
by the owner.

No phase begins automatically. Each phase is an approval gate: the product
owner reviews scope, changes priorities if needed, and explicitly approves
implementation.

## Product Decisions

- Aio is a consumer product, not a developer or operations console.
- Keep Next.js as the product/control plane and Hermes as the execution plane.
- Keep one default Aio agent. Do not add visible multi-agent complexity yet.
- Make powerful workflows understandable through progress, approvals, sources,
  artifacts, and history.
- Deep Research is the next flagship workflow, but durable runs and safety must
  support it before public beta.
- Tool Registry is internal governance. A user-facing Tool Center is not a
  near-term product surface.
- Agent Builder and Workflow Canvas are deferred until real user behavior
  proves that reusable custom agents are needed.
- Stay on Postgres/pgvector for now. Qdrant requires a measured retrieval
  bottleneck and a separate architecture decision.

## Repository Audit

### Already Present

- Next.js control plane and Hermes runtime boundary.
- Auth-aware request context, runtime provisioning, and thread binding.
- Credit reservation, refund, and settlement scaffolding.
- `AioRunEvent`, Hermes event mapping, live Run Timeline, and legacy stream
  compatibility.
- Live approval request and response UI/API.
- Conversation persistence.
- Knowledge upload, indexing, retrieval context, and settings UI.
- Deep Research mode with progress UI.
- Paddle provider interface, checkout route, webhook route, and a local
  development provider.
- Private image Gallery and chat-native Kie image generation.
- Playwright dependency and focused UI screenshot tooling.

### Partial or Missing

- Run, event, tool-call, and approval persistence.
- Run replay and reconnect after a browser refresh or dropped stream.
- Versioned event envelope and contract tests.
- Internal tool risk registry and durable audit trail.
- Production telemetry, evaluations, SLOs, and incident runbooks.
- Background queue and independent workers for long-running jobs.
- Citation/source lifecycle for Deep Research and Knowledge.
- Production subscription reconciliation and billing ledger.
- Legal, privacy, data export/deletion, and retention workflows.
- CI that actually targets `main`, runs from the correct workspace, and tests
  critical product flows.

### Research Recommendations Not Accepted As-Is

- **Developer/startup-operator niche:** rejected as the primary positioning.
  Research quality and reliable execution remain useful, but the interface and
  onboarding must stay consumer-oriented.
- **Agent Builder in the near term:** deferred.
- **Workflow Canvas in the near term:** deferred.
- **Multi-agent workflow now:** deferred until single-agent runs are durable,
  observable, and evaluated.
- **Qdrant now:** deferred.
- **BullMQ as a locked choice:** not accepted yet. Queue technology must fit
  both the TypeScript control plane and Python execution plane.

## Effort Scale

- `XS`: up to half a day
- `S`: about one day
- `M`: two to three days

Anything larger must be split before implementation.

## Roadmap Overview

| Gate | Outcome | Target effort | Depends on |
|---|---|---:|---|
| R0 | CI and production safety baseline | 1 week | None |
| R1 | Durable run foundation | 2-3 weeks | R0 |
| R2 | Tool governance and approvals | 2 weeks | R1 |
| R3 | Observability, cost, and evals | 2 weeks | R1 |
| R4 | Durable Deep Research and Knowledge | 3-4 weeks | R1, R2, R3 |
| R5 | Async workers and scheduled work | 2-3 weeks | R1, R3 |
| R6 | Commercial private beta readiness | 2-3 weeks | R0-R5 |
| R7 | Post-beta expansion | evidence-driven | Beta data |

R2 and R3 may run in parallel after R1.

## R0: CI and Production Safety Baseline

Goal: make every later change verifiable and prevent development shortcuts
from reaching production.

- [x] `R0.1` `XS` Change CI branch filters from `master` to `main`.
  Done when pushes and pull requests to `main` trigger CI.
- [x] `R0.2` `XS` Set the workflow working directory to `apps/web` and enable
  npm cache from `apps/web/package-lock.json`.
  Done when a clean GitHub runner can install and build.
- [x] `R0.3` `S` Add focused web unit tests to CI.
  Done when mapper, event adapter, billing normalization, and input validation
  tests run on every pull request.
- [x] `R0.4` `M` Add Playwright smoke tests for login/dev bypass, chat submit,
  approval, Deep Research mode, Settings, and image creation UI.
  Done when critical UI flows pass at desktop and mobile sizes.
- [x] `R0.5` `S` Add secret scanning and dependency review.
  Done when pull requests fail on committed credentials or newly introduced
  vulnerable production dependencies.
- [x] `R0.6` `S` Add a production startup guard for `DEV_AUTH_BYPASS`, inline
  runtime keys, and development payment providers.
  Done when a production build refuses unsafe configuration.
- [x] `R0.7` `S` Add migration ordering and clean-database verification.
  Done when all migrations apply to an empty test database in CI.
- [x] `R0.8` `XS` Record baseline success, latency, and cost measurements for
  chat, research, and image generation.
  Done when later phases have a comparison baseline.

**Gate R0:** CI passes from a clean checkout and unsafe production
configuration fails closed. Historical secret triage is closed for R0 by owner
decision without a Git history rewrite.

## R1: Durable Run Foundation

Goal: make run history, replay, reconnect, support, and future jobs reliable.

- [ ] `R1.1` `S` Write an ADR for the Aio run/event ownership boundary.
  Done when Aio owns product run IDs and Hermes IDs remain adapter metadata.
- [ ] `R1.2` `M` Define versioned `AioRunEventEnvelopeV1`.
  Include `id`, `schemaVersion`, `runId`, `threadId`, sequence, type,
  timestamps, and typed payload.
- [ ] `R1.3` `M` Add `aio_runs` migration with tenant RLS and lifecycle indexes.
- [ ] `R1.4` `M` Add append-only `aio_run_events` migration with unique
  `(run_id, sequence)` and tenant RLS.
- [ ] `R1.5` `M` Add `aio_tool_calls` and `aio_approvals` migrations with
  idempotency keys and lifecycle indexes.
- [ ] `R1.6` `M` Build a server-only run repository for create, append, update,
  list, and fetch operations.
- [ ] `R1.7` `S` Create the Aio run before calling Hermes and store the Hermes
  run ID only after runtime acceptance.
- [ ] `R1.8` `M` Append mapped events to storage with idempotency and monotonic
  sequence handling.
- [ ] `R1.9` `M` Split chat orchestration business logic from AI SDK stream
  transport without changing visible behavior.
- [ ] `R1.10` `M` Add authenticated run APIs: list, detail, events, and stop.
- [ ] `R1.11` `M` Load Run Timeline from persisted events and merge live events
  without duplicates.
- [ ] `R1.12` `M` Add reconnect behavior for a refreshed or temporarily
  disconnected browser.
- [ ] `R1.13` `M` Add contract, RLS, replay, and duplicate-event tests.

**Gate R1:** every run is persisted, can be replayed after refresh, and cannot
be read across tenants.

## R2: Tool Governance and Durable Approvals

Goal: make sensitive actions predictable, reviewable, and auditable without
adding a developer-facing Tool Center.

- [ ] `R2.1` `S` Inventory all enabled Hermes tools and their side effects.
- [ ] `R2.2` `M` Define an internal versioned tool manifest with risk level,
  approval policy, data access, timeout, and owner.
- [ ] `R2.3` `M` Persist every tool call transition and redact sensitive input
  and output fields before storage.
- [ ] `R2.4` `M` Persist approval requested, resolved, expired, and cancelled
  states.
- [ ] `R2.5` `M` Resume a waiting run exactly once after approval.
- [ ] `R2.6` `S` Define mandatory approval defaults for email, publishing,
  payment, destructive file operations, shell commands, and external writes.
- [ ] `R2.7` `S` Add approval expiry and a clear user-facing expired state.
- [ ] `R2.8` `M` Add an append-only audit log for approvals, credential changes,
  admin actions, and destructive tools.
- [ ] `R2.9` `M` Restrict MCP integrations to an allowlisted catalog with
  tenant binding and audit metadata.
- [ ] `R2.10` `M` Add denial, replay, expiry, and cross-tenant security tests.

**Gate R2:** every dangerous tool requires the correct approval and produces a
durable audit trail.

## R3: Observability, Cost, and Evaluations

Goal: know whether Aio is useful, slow, expensive, or failing before users
report it.

- [ ] `R3.1` `S` Write an ADR selecting the telemetry stack and data-retention
  boundaries. Prefer OpenTelemetry with a replaceable Langfuse adapter.
- [ ] `R3.2` `M` Add correlation IDs across request context, Aio run, Hermes
  run, provider call, tool call, and billing settlement.
- [ ] `R3.3` `M` Instrument chat orchestration and Hermes client spans.
- [ ] `R3.4` `M` Instrument knowledge retrieval, approvals, image generation,
  and billing spans.
- [ ] `R3.5` `M` Record per-run model, tool, provider, latency, and cost usage.
- [ ] `R3.6` `S` Define initial SLOs: turn success, time to first response,
  long-run completion, and approval-resume success.
- [ ] `R3.7` `M` Build an internal reliability/cost dashboard.
- [ ] `R3.8` `M` Create a small golden evaluation set for chat, planning,
  research citations, memory, and safety.
- [ ] `R3.9` `S` Add post-release synthetic checks for login, chat, and one
  harmless approval flow.
- [ ] `R3.10` `M` Write runbooks for provider outage, Hermes unavailable,
  approval stuck, knowledge job stuck, billing drift, and leaked credentials.

**Gate R3:** a failed or expensive run can be traced from UI request to the
specific runtime/provider/tool cause.

## R4: Durable Deep Research and Knowledge

Goal: turn the current Deep Research mode into a consumer workflow worth
returning to.

- [ ] `R4.1` `S` Lock the Deep Research job states and user-facing copy.
- [ ] `R4.2` `M` Persist research plan, steps, queries, sources, and report
  artifact against the Aio run.
- [ ] `R4.3` `M` Add citation entities with source URL, title, fetched time,
  excerpt, and report anchors.
- [ ] `R4.4` `M` Render inline citations and a clean Sources view from persisted
  citation data.
- [ ] `R4.5` `M` Support stop, resume, and retry from the last durable step.
- [ ] `R4.6` `M` Export a report as Markdown and PDF with source references.
- [ ] `R4.7` `M` Turn Knowledge uploads into durable ingestion jobs with parse,
  index, ready, failed, and retry states.
- [ ] `R4.8` `M` Add document/source detail, delete, re-index, and storage
  cleanup behavior.
- [ ] `R4.9` `M` Combine user Knowledge and web sources with visible provenance.
- [ ] `R4.10` `M` Add citation coverage, unsupported-claim, retrieval, and report
  export tests.
- [ ] `R4.11` `S` Measure completion rate, source coverage, retry rate, cost,
  and report reopen rate.

**Gate R4:** a research run survives refresh, shows traceable sources, exports
cleanly, and can resume after interruption.

## R5: Async Workers and Scheduled Work

Goal: remove long-running work from request lifetimes and make retries safe.

- [ ] `R5.1` `S` Write a queue ADR comparing Postgres-backed and Redis-backed
  options across the TypeScript and Python planes.
- [ ] `R5.2` `M` Define a versioned job envelope with tenant, run, job type,
  idempotency key, attempts, timeout, and trace context.
- [ ] `R5.3` `M` Add worker registration, heartbeat, lease, and stale-job
  recovery.
- [ ] `R5.4` `M` Move Knowledge ingestion to the worker path.
- [ ] `R5.5` `M` Move Deep Research execution to the worker path.
- [ ] `R5.6` `M` Move image generation polling and persistence to the worker
  path while keeping live status updates.
- [ ] `R5.7` `M` Back Scheduled Tasks with durable jobs and persisted results.
- [ ] `R5.8` `S` Add bounded exponential retry and dead-letter handling.
- [ ] `R5.9` `S` Add cleanup for abandoned uploads, runs, browser sessions, and
  provider tasks.
- [ ] `R5.10` `M` Add duplicate delivery, worker crash, timeout, cancellation,
  and retry tests.

**Gate R5:** long tasks continue safely beyond a web request and duplicate
delivery cannot duplicate side effects or billing.

## R6: Commercial Private Beta Readiness

Goal: invite external users without relying on manual recovery or ambiguous
data practices.

- [ ] `R6.1` `M` Complete Paddle sandbox checkout and verified webhook tests.
- [ ] `R6.2` `M` Add subscription and billing-event tables with webhook
  idempotency.
- [ ] `R6.3` `M` Reconcile subscriptions, credit grants, cancellations, and
  failed payments.
- [ ] `R6.4` `S` Remove the development payment fallback from production.
- [ ] `R6.5` `M` Complete first-run personalization and three consumer task
  starters: Research, My Documents, and Create.
- [ ] `R6.6` `M` Add transparent usage history and per-task cost estimates.
- [ ] `R6.7` `M` Add account data export, account deletion, and retention
  enforcement.
- [ ] `R6.8` `M` Publish Terms, Privacy, Acceptable Use, and provider/data-use
  disclosures.
- [ ] `R6.9` `M` Add support diagnostics that expose IDs and statuses without
  exposing prompts, credentials, or private files by default.
- [ ] `R6.10` `M` Run tenant-isolation, authorization, upload, rate-limit, and
  webhook security review.
- [ ] `R6.11` `M` Run a small load test and chaos-lite tests for provider and
  worker failure.
- [ ] `R6.12` `S` Create beta feedback, incident, rollback, and release
  checklists.

**Gate R6:** private beta launch checklist passes, billing reconciles, users
can delete/export their data, and critical SLOs have alerts.

## R7: Post-Beta Expansion

These items require product evidence and are not approved by this roadmap:

- Hosted browser execution with live view and session recordings.
- More Knowledge connectors.
- Proactive recurring monitoring.
- Reusable consumer routines or assistants.
- Specialist agents behind one Aio identity.
- Enterprise dedicated runtime and self-hosting.
- A dedicated vector database.

Each item needs a separate product brief containing demand evidence, expected
user outcome, risk, cost, and a kill criterion.

## Metrics

Review weekly:

- First successful run activation
- D1 and W1 retention
- Run and research completion rate
- Approval accept, reject, expiry, and resume rate
- Time to first response and total task duration
- Cost per successful outcome and per active user
- Citation coverage and source-open rate
- Knowledge retrieval success
- Top failing tools and providers
- Image creation success and save/reuse rate

Metrics must be segmented by workflow and provider. Aggregate token counts are
not a product outcome.

## Global Definition of Done

Every task must include:

- Tenant authorization and server-side secret handling
- Typed contracts and validation
- Error, empty, loading, retry, and cancellation states where relevant
- Unit or integration coverage proportional to risk
- Desktop and mobile UI verification for user-facing changes
- No new production warning without an owner
- Documentation for operational behavior
- Aio online and health-checked after local implementation

## Recommended Next Approval

Approve **R0: CI and Production Safety Baseline** first. It is small, does not
change the product UI, and makes every later feature safer to build and review.
