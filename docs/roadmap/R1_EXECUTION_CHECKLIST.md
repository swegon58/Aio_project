# R1 Execution Checklist

**Implementation branch:** `feat/r1-durable-run-foundation`
**Implementation worktree:** `/home/swegon/AI_Agent/Aio_project_r1`
**Branched from:** `origin/main` at `8a8718a`
**Updated:** 2026-06-28
**Owner:** Main coding agent
**Status:** Approved by product owner on 2026-06-28. R1.1–R1.6 complete and verified; R1.7 next.

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

- [x] `XS` Write `docs/architecture/ADR-001-aio-run-ownership.md`. ✅ Done 2026-06-28

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

- [x] `M` Add ordered migrations `0009_*` and `0010_*` for runs and events. ✅ Done 2026-06-28

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

**Status (2026-06-28):** verified live. Local Supabase stack brought up with
`supabase start --exclude edge-runtime,studio` (the Deno edge-runtime worker
fails to fetch `@panva/jose` from `jsr.io` — a registry 403 unrelated to the
schema; Postgres/auth/storage all healthy). Results:

- `supabase db reset` applies migrations `0001`–`0010` in order, exit 0.
- `supabase db lint --local --level warning --fail-on warning` →
  "No schema errors found", exit 0.
- Cross-tenant RLS probe (rolled back, synthetic users A/B):
  authenticated tenant A sees exactly its own 1 `aio_runs` row and 1
  `aio_run_events` row, **0 rows leaked** from tenant B; INSERT by A raises
  `new row violates row-level security policy`; UPDATE and DELETE affect
  `0` rows. Writes are service-role-only by construction (no insert/update/
  delete policies for anon/authenticated).

R1.3 complete. R1.4 repositories may now be written against the verified
schema.

Pass: migrations `0001`-`0010` apply in order; lint exits `0`; cross-tenant RLS
test denies the wrong tenant.

### R1.4 Server Repositories

- [x] `M` Add server-only repositories and the state machine. ✅ Done 2026-06-28

**Files:**

- `apps/web/src/lib/aio/runs/run-state-machine.ts` (new)
- `apps/web/src/lib/aio/runs/run-repository.ts` (new)
- `apps/web/src/lib/aio/runs/run-event-repository.ts` (new)
- `apps/web/supabase/migrations/0011_aio_run_event_append_fn.sql` (new)
- `apps/web/src/lib/aio/runs/run-state-machine.test.ts` (new, 8 tests)
- `apps/web/src/lib/aio/runs/run-repository.test.ts` (new, 2 tests)
- `apps/web/scripts/r1-4-repo-probe.ts` (new, live probe)

**Required methods:** create run; attach Hermes identity; append event
transactionally and idempotently; transition state with allowed-transition
validation; mark terminal; request cancellation; list user runs with cursor
pagination; fetch run plus ordered events.

**Rules:** server-only; no route contains raw lifecycle SQL; append and
transition are transactional where required; errors use stable internal codes.

**Deviation note (2026-06-28):** the draft listed three files; a fourth,
`0011_aio_run_event_append_fn.sql`, was added. The Supabase JS client has no
client-side transaction, so assigning the next monotonic `(run_id, sequence)`
*and* inserting *and* deduping on envelope `id` must be one server-side step.
`aio_append_run_event` (SECURITY INVOKER, service-role only) does exactly that
and returns `(id, sequence, inserted, conflict)` so the repository can map
`duplicate_id` -> idempotent no-op and `sequence_race` -> caller retry. This
matches the existing RPC convention (`vault_store_openrouter_key`).

**Design choices:**

- `run-state-machine.ts` is pure logic; the repositories call `transition` /
  `requestCancel` before persisting, so `aio_runs.status` never reaches an
  illegal state. `from === to` is an idempotent no-op success in `transitionRun`;
  every guarded update adds `.eq("status", from)` (optimistic concurrency) and
  re-reads/re-validates once when the guard matches 0 rows.
- Repository errors are a discriminated union (`RepoResult<T> = RepoOk<T> |
  RepoError`) with stable `REPO_ERROR_CODE`s (`RUN_NOT_FOUND`,
  `INVALID_TRANSITION`, `ALREADY_TERMINAL`, `SEQUENCE_RACE`, `BAD_CURSOR`,
  `DB_ERROR`); the functions never throw for domain errors. Wrong-tenant is
  reported as `RUN_NOT_FOUND` so existence never leaks.
- One-directional dependency: `run-event-repository` imports shared types and
  `getRun` from `run-repository`; `getRunWithEvents` lives in the event repo.
- Cursor pagination is keyset over `(created_at desc, id desc)`; the cursor is
  base64url JSON `{createdAt, id}`, decoded defensively (bad cursor ->
  `BAD_CURSOR`). `listRuns` fetches `limit+1` to detect a next page.
- `appendEvent` redacts the payload via `redactEventPayload` and normalizes both
  timestamps before persistence; the producer hands payload + metadata, the
  repository owns sequence and `schemaVersion`.

**Evidence (2026-06-28):**

- `npm run typecheck` clean.
- `npm run test:unit` -> 33/33 pass (8 state-machine + 2 cursor + the prior 23).
  The state-machine test asserts the full 7×7 transition matrix against ADR-001
  §3, every forbidden non-terminal edge -> `INVALID_TRANSITION`, every edge out of
  a terminal state -> `ALREADY_TERMINAL`, and `requestCancel` idempotency.
- Live probe (`scripts/r1-4-repo-probe.ts`) against the local stack: 22/22 checks
  pass — create/read, wrong-tenant `RUN_NOT_FOUND`, Hermes identity, queued→running
  (+ idempotent self-transition), append seq 0, replay -> `inserted:false`,
  append seq 1, ordered `listEvents [0,1]`, `afterSequence=0 -> [1]`,
  `getRunWithEvents`, mark terminal (`completed_at` stamped), cancel/transition on
  terminal -> `ALREADY_TERMINAL`, queued→completed -> `INVALID_TRANSITION`,
  cancel queued→cancelling (+ cancelling→cancelling noop), 2-page cursor list with
  no overlap, and bad cursor -> `BAD_CURSOR`. The synthetic tenant + its runs and
  events are cascade-deleted at the end.

Pass: state-machine + cursor unit tests pass; live probe exercises every
repository method and the idempotent/transactional append; no route contains raw
lifecycle SQL (none exists yet — R1.5 will route through these repositories).

### R1.5 Split Chat Orchestration From Transport

- [x] `M` Refactor the chat route into a thin route, orchestrator, and transport. ✅ Done 2026-06-28

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

**Evidence (2026-06-28):**

- `apps/web/src/app/api/chat/route.ts` is now transport-only and delegates to
  `handleChatRequest`.
- `apps/web/src/lib/aio/chat/chat-transport.ts` owns request parsing,
  empty-message rejection, and UI-message-stream response wiring only.
- `apps/web/src/lib/aio/chat/run-orchestrator.ts` now owns auth/context,
  credit reserve/refund/settlement, input scanning, knowledge context, the
  Hermes run lifecycle, durable run creation before the Hermes call, Hermes
  identity attachment, durable event persistence, and final conversation
  persistence.
- `createRun` now fails closed before Hermes starts, matching the R1.5
  acceptance rule that the Aio-owned run row must exist first.
- `conversation_id` is linked at run creation time via the existing `threadId`.
- Persisted events now use deterministic envelope ids plus source-aware Hermes
  metadata, and preserve their source timestamps instead of writing `Date.now()`
  for every event.
- Verification: `npm run typecheck` passes, `npm run test:unit` passes
  (`33/33`), `npm run lint` reports the same `281` pre-existing warnings and no
  errors, and `AIO_DEPLOYMENT_ENV=development npm run build` passes in the R1
  worktree after replacing the invalid `node_modules` symlink with a local
  install.

### R1.6 Run APIs

- [x] `S` Add run read/stop APIs and the OpenAPI document. ✅ Done 2026-06-28

**Files:**

- `apps/web/src/app/api/runs/route.ts` (`GET /api/runs`)
- `apps/web/src/app/api/runs/[runId]/route.ts` (`GET /api/runs/[runId]`)
- `apps/web/src/app/api/runs/[runId]/events/route.ts`
  (`GET .../events?afterSequence=`)
- `apps/web/src/app/api/runs/[runId]/stop/route.ts` (`POST .../stop`)
- `apps/web/src/lib/aio/runs/run-api.ts` (auth/context, serialization, stable API errors)
- `apps/web/src/lib/aio/runs/run-api.test.ts` (helper/unit coverage)
- `apps/web/scripts/r1-6-runs-api-probe.ts` (live HTTP probe)
- `docs/api/aio-runs.openapi.yaml` (OpenAPI 3.1, new)

**Contracts:** authenticated, tenant-scoped, cursor pagination, stable error
schema, event replay supports `afterSequence`, stop is idempotent.

**Evidence (2026-06-28):**

- `apps/web/src/lib/aio/runs/run-api.ts` now mirrors the app's local-dev auth
  behavior: when `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`, the run APIs resolve the
  fixed dev tenant instead of returning `401`, while still hard-failing if that
  bypass is enabled in production.
- `parseBoundedInt` is strict (`^-?\d+$`) so inputs like `1.5` and `12px` are
  rejected instead of being truncated silently.
- `apps/web/src/lib/aio/runs/run-api.test.ts` covers bounded integer parsing,
  stable repository-error-to-HTTP mapping, and the public serialization shape
  for both runs and run events.
- `apps/web/scripts/r1-6-runs-api-probe.ts` hits the live Next server over HTTP
  and proves the four contracts against the real repositories:
  - `GET /api/runs` returns the newest tenant-scoped runs and rejects bad
    `limit` / `cursor` values.
  - `GET /api/runs/[runId]` returns a run shell and reports missing runs as
    `RUN_NOT_FOUND`.
  - `GET /api/runs/[runId]/events` replays the ordered timeline and honors
    `afterSequence`.
  - `POST /api/runs/[runId]/stop` is correct for queued/not-started runs,
    terminal/no-op runs, and Hermes-forwarded runs where Hermes returns `404`.
- Verification:
  - `npm run typecheck` passes.
  - `npm run test:unit` passes (`36/36`).
  - `AIO_DEPLOYMENT_ENV=development npm run build` passes with the run routes.
  - `npx tsx scripts/r1-6-runs-api-probe.ts` passes against a local R1 server
    after:
    - `supabase db reset` reapplies migrations `0001`-`0011`
    - the app is started with local Supabase JWT keys from
      `supabase status -o env`
    - the shared hosted `.env.local` symlink is moved aside for that local-only
      probe process so Next does not override the local runtime env
    - a minimal local stub on `127.0.0.1:8642` answers `POST /v1/runs/:id/stop`
      with `404` to verify the missing-Hermes-run branch explicitly
  - The probe now proves all four contracts live:
    - list/detail/events routes
    - queued stop before Hermes starts
    - missing-Hermes-run stop tolerance (`run_not_found`)
    - terminal stop idempotency (`noop: true`, status unchanged)

### R1.7 Timeline Replay And Reconnect

- [x] `M` Reconnect the run timeline to persisted history. ✅ Completed 2026-06-29

**Files:**

- `apps/web/src/components/app/run-timeline/` (update)
- `apps/web/src/components/app/AppHome.tsx` (update)
- run state hooks under `apps/web/src/lib` or `apps/web/src/hooks`
- `apps/web/src/lib/aio/runs/run-client.ts` (new, browser fetch helpers)
- `apps/web/e2e/app-smoke.spec.ts` (extended reload/restore smoke)

**Behavior:** optimistic run shell after submit; hydrate persisted history; merge
live events by ID/sequence without duplicates; reconnect after refresh; render
running, waiting approval, completed, failed, cancelled; stop control appears
only for stoppable states; loading/reconnect/error states never erase existing
events. Internal IDs and debug data stay hidden from the user.

**Status (2026-06-29): completed**

- `AppHome.tsx` now primes an optimistic `run.created` shell on submit, then
  drops that shell once a real durable run/event stream takes over or the turn
  completes without a durable run id.
- The active conversation restore flow now hydrates the latest durable run via
  `GET /api/runs?conversationId=...&limit=1`, then replays its persisted events
  from `GET /api/runs/[runId]/events`.
- Non-terminal runs now poll `GET /api/runs/[runId]` +
  `GET /api/runs/[runId]/events?afterSequence=` every 3 seconds when no live
  stream is attached, so a refresh no longer strands the timeline in an empty
  state.
- `apps/web/e2e/app-smoke.spec.ts` now includes a durable reload smoke that
  proves the client re-requests `/api/conversations/:id`, `/api/runs` with the
  `conversationId` filter, and `/api/runs/:id/events` both on initial load and
  after a browser refresh.
- The restored timeline now appears in a visible `Current Run` surface by
  default:
  - desktop: inside the right-side Aio panel
  - mobile: inside the Today strip area above the suggestion cards
- That `Current Run` surface now renders:
  - a durable run-status badge (`Queued`, `Running`, `Needs approval`,
    `Stopping`, `Completed`, `Failed`, `Cancelled`)
  - reconnect / restore / stop-request messaging that never clears saved events
  - a durable `Stop run` control shown only for stoppable states, wired to
    `POST /api/runs/[runId]/stop`
  - the compact persisted `RunTimeline` so restored history is visible without
    opening the output drawer
- `apps/web/e2e/app-smoke.spec.ts` now also proves the UI surface itself:
  - restored `Current Run` appears after reload on both desktop and mobile
  - `Stop run` issues the durable stop request and transitions the visible run
    surface to `Stopping`

**Verification (2026-06-29):**

- `npm run typecheck` passes.
- `npm run test:unit` passes (`36/36`).
- `AIO_DEPLOYMENT_ENV=development npm run build` passes.
- `npm run test:e2e -- app-smoke.spec.ts` passes (`6/6`).
- `npm run test:e2e` passes (`6/6`).
- `git diff --check` passes.

## Final Gate (must all pass before requesting merge)

- [x] `npm run lint` exits with no new errors.
- [x] `npm run typecheck` passes.
- [x] `npm run test:unit` passes, including new R1.2 envelope tests.
- [x] `npm run test:e2e` passes; existing smoke flows still green.
- [x] `AIO_DEPLOYMENT_ENV=development npm run build` passes.
- [x] Clean migration `0001`-`0011` applies and DB lint exits `0`.
- [x] Cross-tenant RLS test denies the wrong tenant.
- [x] Replay test: drop the stream, refresh, timeline rehydrates with no
      duplicates and no lost events.
- [x] Stop is idempotent (second call on a terminal run is a no-op).
- [x] `git diff --check` clean; no secrets in diff.
- [x] Aio is online at `http://localhost:3000/app` after work.

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

R1.1 (ADR-001), R1.2 (versioned event contract), R1.3 (DB schema), and R1.4
(server repositories + state machine + the `0011` append RPC) are all committed
and verified on `feat/r1-durable-run-foundation`. The local Supabase stack is up
(Postgres on `127.0.0.1:54322`, REST on `127.0.0.1:54321`) with migrations
`0001`–`0011` applied, RLS isolation confirmed, and the R1.4 repository probe
22/22 green.

Next: finish the merge-readiness handoff:

- summarize R1 evidence for the product owner and request merge approval
- merge `feat/r1-durable-run-foundation` after approval
