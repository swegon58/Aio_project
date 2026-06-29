# R2 Execution Checklist

Goal: every sensitive action is predictable, reviewable, resumable, and
auditable.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Current State

- R2 is now merged into `main` as part of the integrated R2-R4 line at
  commit `a66d2f1`.
- The merged stack includes:
  - R2.1 manifest + policy + risk register
  - R2.2 durable tool calls
  - R2.3 durable approvals and resolve API
  - R2.4 approval UI wired into the run timeline
  - R2.5 mandatory approval policy enforcement
  - R2.6 append-only audit log groundwork and MCP boundary policy surfaces
  - R2.7 focused gate tests now included in `npm run test:unit`
- Most recent post-merge verification on `main`:
  - `npm run typecheck`
  - `npm run test:unit` (`133` tests passed)
  - `AIO_DEPLOYMENT_ENV=development npm run build`

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
- [x] Wire repository into run orchestrator so real runs persist tool calls
- [x] Add Supabase integration tests (cross-tenant, transition races)
- [x] Verified: `npm run typecheck`, `npm run test:unit` (54/54), live `scripts/r2-2-tool-call-probe.ts` (10/10) against local Supabase stack

### R2.3 Durable Approvals

- [x] Add `aio_approvals` migration (`0013_aio_approvals.sql`, RLS select-only)
- [x] Add approval state machine + repository (snapshot risk, redacted request, TTL)
- [x] Add approval read/resolve server APIs (`GET .../approvals`, `POST .../resolve`)
- [x] Wire `recordApprovalEvent` into run orchestrator (mirrors `recordToolCallEvent`)
- [x] Enforce resolve-once, idempotent replay, and expiry rules (lazy + bulk sweep)
- [x] Verified: `npm run typecheck`, `npm run test:unit` (65/65), eslint clean, live `scripts/r2-3-approval-probe.ts` (11/11) against local Supabase stack

### R2.4 Approval UI

- [x] Replace live-only approval card assumptions with durable approval reads
- [x] Show requested/resolved/expired states in the run timeline

### R2.5 Mandatory Policies

- [x] Enforce default approval requirements from the manifest/policy layer
- [x] Block dangerous execution paths that lack a durable approval row

### R2.6 Audit Log And MCP Boundary

- [x] Add append-only audit records
- [x] Add MCP allowlist and tenant binding enforcement

### R2.7 Tests

- [x] Approval allow/deny/expire/replay coverage
- [x] Dangerous tool cannot start without approval
- [x] Safe tool avoids unnecessary approval
- [x] Cross-tenant approval denial
- [x] Audit row emitted on every terminal path

## Exact Next Step

R2 is no longer the active gate. Continue from the current `main` baseline and
use this file as historical evidence for what the merged R2 slice delivered.
