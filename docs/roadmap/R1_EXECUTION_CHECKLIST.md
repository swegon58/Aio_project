# R1 Execution Checklist

**Implementation branch:** `feat/r1-durable-run-foundation`
**Implementation worktree:** `/home/swegon/AI_Agent/Aio_project_r1`
**Branched from:** `origin/main` at `8a8718a`
**Updated:** 2026-06-28
**Owner:** Main coding agent
**Status:** Approved by product owner on 2026-06-28. R1.1 in progress.

This file tracks active work for the R1 phase. The full product sequence lives
in `2026-06-28_aio_product_and_production_roadmap.md`. The code-level program
for R0-R7 is at the repository root: `AIO_MASTER_EXECUTION_PLAN.md`. The R1.1
architecture decision is recorded in `docs/architecture/ADR-001-aio-run-ownership.md`.

## Goal

Every Aio run is durable, replayable, tenant-safe, and reconnectable. After R1:

- A run survives a browser refresh, a dropped SSE stream, and a backend restart.
- The run timeline can be replayed from Postgres, not only from a live stream.
- Run lifecycle transitions are explicit, validated, and auditable.
- The browser never writes lifecycle rows directly; it reads and acts through
  server-owned APIs.

## Instructions For The Implementation Agent

1. Work only in `/home/swegon/AI_Agent/Aio_project_r1` on `feat/r1-durable-run-foundation`.
2. Never implement R1 in the research worktree or directly on `main`.
3. Do one R1.x task at a time, in order. Do not start R1.(n+1) because R1.n looks
   skippable; each task establishes a contract the next depends on.
4. Keep Hermes-specific names behind `apps/web/src/lib/aio/hermes`. Product code
   depends on Aio concepts (`runId`, `AioRunEvent`, `AioRunStatus`) first.
5. Preserve the existing legacy `data-hermes-*` stream parts. R1 adds
   persistence and replay; it does not remove the compatibility stream.
6. Do not merge to `main`, force-push, rotate credentials, or choose paid
   infrastructure without owner approval.
7. Never expose values from `.env`, `.mcp.json`, Git history, credential stores,
   or process environments. Redact tool outputs before persisting events.
8. Update a task's status only after its acceptance commands pass. Record the
   exact next task at the bottom.
9. Preserve unrelated user changes; never reset or revert files outside R1.

## Status Key

- `[x]` verified complete
- `[ ]` not started
- `[-]` in progress
- `[!]` blocked or failed

## Current State And Gaps (verified against code)

The R1 code is not a greenfield. These findings anchor every task below:

- `apps/web/src/lib/aio/runs/aio-run-events.ts` already defines the
  `AioRunEvent` union (~15 types) and `AioRunStatus`. There is **no envelope**:
  no `schemaVersion`, no `sequence`, no globally-unique `id`, no `source`,
  no `receivedAt`, no `hermes` adapter metadata.
- `AioRunStatus` is `queued | running | waiting_approval | completed | failed |
  cancelled`. The **`cancelling` transient state is missing** and must be added
  with R1.1/R1.3.
- `apps/web/src/lib/aio/hermes/hermes-event-mapper.ts` maps Hermes events to
  `AioRunEvent[]`. The `default` branch returns `[]`, so **unknown Hermes
  events are dropped silently**. R1.2 requires they become adapter diagnostics.
- The mapper holds mutable positional state (`runningToolIds`,
  `activeCodeExecTaskId`) keyed by tool name and order, not by a stable Hermes
  event identifier. **Replaying the same stream is not idempotent today.**
- `timestampFields` / `normalizeTimestampMs` already normalize seconds to
  milliseconds. The R1.2 timestamp test is partly satisfied already.
- One Hermes event can map to several product events (e.g. `tool.completed` +
  `artifact.created`). **Product-event sequence numbers are per product event,
  not per Hermes event.**
- `threadId` appears reliably only on `run.created`. The envelope layer must
  stamp `threadId` on every envelope from the resolved run context.
- No run, event, or tool-call persistence exists. Migrations end at `0008`.
  R1.3 begins at `0009`.
- `apps/web/src/lib/aio/runs/` currently contains only `aio-run-events.ts` and
  `run-event-writer.ts`. R1.2 and R1.4 add the envelope, schema, repositories,
  and state machine.

## R1 Checklist

### R1.1 Architecture Decision

- [-] `XS` Write `docs/architecture/ADR-001-aio-run-ownership.md`.
  - Status: draft in progress in this worktree.

The ADR must lock: Aio run ID ownership, Hermes run/session ID mapping, run
state machine (including `cancelling`), event ordering and idempotency,
reconnect and replay semantics, cancellation semantics, and retention boundary.
Acceptance: no transition is implied by UI state; terminal states are immutable
except administrative repair with audit.

### R1.2 Versioned Event Contract

- [x] `S` Add the V1 envelope and schema; harden the mapper. ✅ Done 2026-06-28

**Files:**

- `apps/web/src/lib/aio/runs/aio-run-events.ts` (extend; do not break legacy)
- `apps/web/src/lib/aio/runs/aio-run-event-envelope.ts` (new)
- `apps/web/src/lib/aio/runs/aio-run-event-schema.ts` (new)
- `apps/web/src/lib/aio/hermes/hermes-event-mapper.ts` (harden)

**Required behavior:**

- V1 envelope: `id`, `schemaVersion: 1`, `runId`, `threadId`, `sequence`,
  `type`, `occurredAt`, `receivedAt`, `source: "aio" | "hermes" | "worker"`,
  `payload`, optional `hermes: { runId?, eventId? }`.
- `(runId, sequence)` unique; envelope `id` globally unique.
- Payload typed by event type. `threadId` populated on every envelope.
- Unknown Hermes events map to an adapter-diagnostic event, never dropped.
- Secrets and large tool outputs are redacted before persistence.
- Mapper stops using positional tool-call state; it keys by stable Hermes
  `tool_call_id` / event identifier so a replay is idempotent.

**Tests (extend `apps/web/src/lib/aio/runs/__tests__`):**

- every mapped event validates against V1
- duplicate Hermes event maps idempotently (no duplicate envelope `id`)
- seconds and milliseconds timestamps normalize correctly
- unknown Hermes event becomes an explicit diagnostic, not `[]`

**Evidence (2026-06-28):**

- `aio-run-events.ts`: added `cancelling` to `AioRunStatus` (ADR-001 §3),
  added `AdapterDiagnosticEvent` to the union, exported `AioRunEventType`. All
  additive; the three live consumers that dispatch on type use safe
  `default`/non-exhaustive branches, so no breakage.
- `aio-run-event-schema.ts` (new): `AIO_RUN_EVENT_SCHEMA_VERSION = 1`,
  `normalizeTimestampToIso`/`normalizeTimestampToMs` (seconds < 10^10 rule),
  `redactEventPayload` (secret-shaped keys → `[redacted]`, strings > 4000
  truncated), `validateEnvelopeShape`.
- `aio-run-event-envelope.ts` (new): `AioRunEventEnvelopeV1`, `createRunEventEnvelope`
  (normalizes both timestamps to ISO, generates UUID id when omitted, optional
  `hermes` metadata). Mapper emits payloads only; sequence is still assigned by
  the R1.4 repository.
- `hermes-event-mapper.ts`: removed positional state (`runningToolIds`,
  `activeCodeExecTaskId`); tool/task ids now derive deterministically from
  `tool_call_id` / `scriptPath` / timestamp; `default` now returns an
  `adapter.diagnostic` instead of `[]`. Existing assertions still pass.
- Tests are co-located with their source (matching the existing
  `hermes-event-mapper.test.ts` convention), not under `__tests__`:
  `aio-run-event-envelope.test.ts` (7) + `hermes-event-mapper.test.ts` (+3) cover
  every required behavior.
- Verification: `npm run typecheck` clean; `npm run test:unit` → 23/23 pass
  (13 in the two R1.2 files, including idempotency, diagnostics, seconds/ms
  normalization, and "every mapped payload validates against V1").

### R1.3 Database Schema

- [~] `M` Add ordered migrations `0009_*` and `0010_*` for runs and events.
  Migrations written 2026-06-28; **live `db reset` + `db lint` verification is
  pending** — the local Supabase stack is currently down, so the task-specific
  check cannot run yet (see Verification below).

**Files:**

- `apps/web/supabase/migrations/0009_aio_runs.sql` (new)
- `apps/web/supabase/migrations/0010_aio_run_events.sql` (new)

**`aio_runs`:** `id uuid pk`, `customer_id uuid not null` (see naming note),
`conversation_id uuid null`, `thread_id text not null`, `status text not null`
(incl. `cancelling`), `mode text not null`, `input_summary text`,
`hermes_run_id text null`, `hermes_session_id text null`, `reserved_credits
numeric`, `actual_credits numeric`, `error_code text null`,
`error_message_redacted text null`,
`created_at/started_at/updated_at/completed_at`, `cancel_requested_at`,
`metadata jsonb` with size check.

**Naming note (deviation from this draft, 2026-06-28):** the draft said
`user_id`; the implemented migrations use `customer_id` instead. Every existing
multi-tenant table (`hermes_registry`, `hermes_conversations`,
`hermes_gallery_images`) and every query in the app key the owner off
`customer_id` → `auth.users(id)`. Using `customer_id` keeps the R1.4
repositories, joins, and RLS policies uniform with the rest of the schema.

**Indexes:** `(customer_id, created_at desc)`, `(customer_id, status,
updated_at desc)`, `(customer_id, thread_id)`, `(conversation_id)` partial,
unique `hermes_run_id` when non-null (partial).

**`aio_run_events`:** envelope fields (`id` pk, `schema_version`, `run_id`,
`customer_id`, `sequence`, `type`, `occurred_at`, `received_at`, `source`,
`payload`, `hermes`), `payload jsonb`, unique `(run_id, sequence)`, unique
envelope `id` (pk), index `(run_id, sequence)` + `(run_id, occurred_at)` +
`(customer_id, received_at desc)`. `customer_id` is denormalized per event so
RLS can isolate tenants without a join.

**RLS:** users read only their own runs/events; the browser cannot insert or
mutate lifecycle rows; service role writes through the server repository;
cross-tenant tests are mandatory. Partition/retention is documented in the ADR
and deferred to a measured scale trigger, not chosen now.

**Verification:**

```bash
cd apps/web
npx -y supabase@2.101.0 db reset
npx -y supabase@2.101.0 db lint --local --level warning --fail-on warning
```

**Status (2026-06-28):** migrations `0009_aio_runs.sql` and
`0010_aio_run_events.sql` are written and statically reviewed (FK ordering
`0007 → 0009 → 0010` resolves; check constraints, partial unique indexes, and
select-only RLS policies in place). The live `db reset` / `db lint` commands
have **not** run because the local Supabase stack is down
(`supabase_db_aio-web` absent). R1.3 stays open until those pass; R1.4
repositories must not be written against an unverified schema.

Pass: migrations `0001`-`0010` apply in order; lint exits `0`; cross-tenant RLS
test denies the wrong tenant.

### R1.4 Server Repositories

- [ ] `M` Add server-only repositories and the state machine.

**Files:**

- `apps/web/src/lib/aio/runs/run-state-machine.ts` (new)
- `apps/web/src/lib/aio/runs/run-repository.ts` (new)
- `apps/web/src/lib/aio/runs/run-event-repository.ts` (new)

**Required methods:** create run; attach Hermes identity; append event
transactionally and idempotently; transition state with allowed-transition
validation; mark terminal; request cancellation; list user runs with cursor
pagination; fetch run plus ordered events.

**Rules:** server-only; no route contains raw lifecycle SQL; append and
transition are transactional where required; errors use stable internal codes.

### R1.5 Split Chat Orchestration From Transport

- [ ] `M` Refactor the chat route into a thin route, orchestrator, and transport.

**Files:**

- `apps/web/src/app/api/chat/route.ts` (thin)
- `apps/web/src/lib/aio/chat/run-orchestrator.ts` (new)
- `apps/web/src/lib/aio/chat/chat-transport.ts` (new)
- existing Hermes adapter modules and `run-event-writer.ts`

**Orchestrator:** authenticate and resolve tenant/runtime context; scan input;
reserve credits via `billing/credit-guard.ts`; create the Aio run **before** the
Hermes call; build knowledge and personalization context; start Hermes
execution; attach Hermes ID; map, persist, and publish events; settle/refund
credits exactly once via `billing/usage-settlement.ts`; persist conversation
linkage; close the run with a stable outcome.

**Transport:** parse request; convert UI messages; expose the AI SDK/SSE stream;
map internal errors to HTTP; handle client disconnect **without corrupting
durable run state**.

### R1.6 Run APIs

- [ ] `S` Add run read/stop APIs and the OpenAPI document.

**Files:**

- `apps/web/src/app/api/runs/route.ts` (`GET /api/runs`)
- `apps/web/src/app/api/runs/[runId]/route.ts` (`GET /api/runs/[runId]`)
- `apps/web/src/app/api/runs/[runId]/events/route.ts`
  (`GET .../events?afterSequence=`)
- `apps/web/src/app/api/runs/[runId]/stop/route.ts` (`POST .../stop`)
- `docs/api/aio-runs.openapi.yaml` (OpenAPI 3.1, new)

**Contracts:** authenticated, tenant-scoped, cursor pagination, stable error
schema, event replay supports `afterSequence`, stop is idempotent.

### R1.7 Timeline Replay And Reconnect

- [ ] `M` Reconnect the run timeline to persisted history.

**Files:**

- `apps/web/src/components/app/run-timeline/` (update)
- `apps/web/src/components/app/AppHome.tsx` (update)
- run state hooks under `apps/web/src/lib` or `apps/web/src/hooks`

**Behavior:** optimistic run shell after submit; hydrate persisted history; merge
live events by ID/sequence without duplicates; reconnect after refresh; render
running, waiting approval, completed, failed, cancelled; stop control appears
only for stoppable states; loading/reconnect/error states never erase existing
events. Internal IDs and debug data stay hidden from the user.

## Final Gate (must all pass before requesting merge)

- [ ] `npm run lint` exits with no new errors.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes, including new R1.2 envelope tests.
- [ ] `npm run test:e2e` passes; existing smoke flows still green.
- [ ] `AIO_DEPLOYMENT_ENV=development npm run build` passes.
- [ ] Clean migration `0001`-`0010` applies and DB lint exits `0`.
- [ ] Cross-tenant RLS test denies the wrong tenant.
- [ ] Replay test: drop the stream, refresh, timeline rehydrates with no
      duplicates and no lost events.
- [ ] Stop is idempotent (second call on a terminal run is a no-op).
- [ ] `git diff --check` clean; no secrets in diff.
- [ ] Aio is online at `http://localhost:3000/app` after work.

## Delegation Map

- **Main/integrator:** R1.1-R1.7 ownership, cross-file decisions, verification,
  commits, checklist updates.
- **Schema reviewer:** read-only review of migrations, RLS, indexes, retention.
- **Contract reviewer:** read-only review of the envelope, schema validation,
  mapper idempotency, and API/OpenAPI shapes.
- **Worker agent:** allowed only on a disjoint file set named in its prompt;
  must not revert concurrent edits and must report every changed file.

Do not delegate: credential handling, Git history rewrite or force-push, merge
to `main`, the final acceptance decision, or two agents editing the same
migration, lockfile, or test file.

## Exact Next Step

R1.1 (ADR-001) and R1.2 (versioned event contract) are committed on
`feat/r1-durable-run-foundation`. R1.3 migrations (`0009_aio_runs.sql`,
`0010_aio_run_events.sql`) are written but **not yet verified live** — the local
Supabase stack is down. Next: start the local stack and run
`supabase db reset` + `supabase db lint --local --level warning --fail-on
warning`; fix any warnings, then commit R1.3. Do not start R1.4 repositories
until the schema applies cleanly and the cross-tenant RLS test denies the wrong
tenant.
