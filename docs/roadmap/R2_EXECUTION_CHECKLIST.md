# R2 Execution Checklist

Goal: every sensitive action is predictable, reviewable, resumable, and
auditable.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Current State

- R1 is merged to `main`.
- R2.1 is complete and verified on `feat/r2-tool-governance-foundation`
  (typecheck, `test:unit` 47/47, eslint clean).
- R2.2 is scaffolded: `aio_tool_calls` migration, tool-call state machine, and
  tool-call repository exist with unit tests, but are NOT yet wired into the
  chat orchestrator, and have no Supabase integration tests yet.
- Browser approval UI currently proxies live Hermes approval state only.

## R2 Checklist

### R2.1 Tool Inventory And Manifest

- [x] Create `apps/web/src/lib/aio/tools/tool-manifest.ts`
- [x] Create `apps/web/src/lib/aio/tools/tool-policy.ts`
- [x] Create `docs/security/aio-tool-risk-register.md`
- [x] Add focused unit tests for manifest coverage and policy resolution
- [x] Lock the first-pass risk model for base tools, tier-gated toolsets,
  providers, and integrations
- [x] Verified: `npm run typecheck`, `npm run test:unit` (47/47), `eslint` clean

### R2.2 Durable Tool Calls

- [x] Add `aio_tool_calls` migration (`0012_aio_tool_calls.sql`, RLS select-only)
- [x] Add tool-call state machine + repository with manifest snapshot
- [x] Redact durable input/output fields (`redactPersistedValue`)
- [~] Wire repository into run orchestrator so real runs persist tool calls
- [ ] Add Supabase integration tests (cross-tenant, transition races)

### R2.3 Durable Approvals

- [ ] Add `aio_approvals` migration
- [ ] Add approval read/resolve server APIs
- [ ] Enforce resolve-once, idempotent replay, and expiry rules

### R2.4 Approval UI

- [ ] Replace live-only approval card assumptions with durable approval reads
- [ ] Show requested/resolved/expired states in the run timeline

### R2.5 Mandatory Policies

- [ ] Enforce default approval requirements from the manifest/policy layer
- [ ] Block dangerous execution paths that lack a durable approval row

### R2.6 Audit Log And MCP Boundary

- [ ] Add append-only audit records
- [ ] Add MCP allowlist and tenant binding enforcement

### R2.7 Tests

- [ ] Approval allow/deny/expire/replay coverage
- [ ] Dangerous tool cannot start without approval
- [ ] Safe tool avoids unnecessary approval
- [ ] Cross-tenant approval denial
- [ ] Audit row emitted on every terminal path

## Exact Next Step

R2.1 is verified and committed. The R2.2 schema + repository scaffold is
committed but not wired into the chat orchestrator and has no integration tests.

Next owner decision:

- continue R2.2 by wiring `tool-call-repository` into the run orchestrator and
  adding Supabase integration tests, or
- move to R2.3 durable approvals (`aio_approvals` table + resolve API) first.

Do not push or merge without owner approval.
