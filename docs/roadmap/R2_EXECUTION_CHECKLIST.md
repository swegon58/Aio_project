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
- R2.2 is complete and verified: `recordToolCallEvent` is wired into the run
  orchestrator (called per `tool.*` event right after `persistEvent`), and
  `scripts/r2-2-tool-call-probe.ts` exercises the full DB path (create +
  transition + missed-started recovery + idempotency + isolation + ordering)
  against the local Supabase stack. typecheck clean, `test:unit` 54/54.
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
- [x] Wire repository into run orchestrator so real runs persist tool calls
- [x] Add Supabase integration tests (cross-tenant, transition races)
- [x] Verified: `npm run typecheck`, `npm run test:unit` (54/54), live `scripts/r2-2-tool-call-probe.ts` (10/10) against local Supabase stack

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

R2.2 is complete and verified (wiring + integration probe green). On
`feat/r2-tool-governance-foundation`, the schema/state-machine/repository are
committed (`df45f9c`); the R2.2 wiring slice — `tool-call-writer.ts` + its unit
tests, the orchestrator wiring edit, and `scripts/r2-2-tool-call-probe.ts` — is
uncommitted in the working tree.

Environment note: `.env.local` (main worktree) points at a cloud Supabase
project (`xeuvoaedwdmuhxdcoxcx`) that was never migrated — every Aio table
404s there. The real dev DB is the local Docker stack (kong on `:54321`,
public demo keys), where all migrations through `0012` are applied. The R2.2
probe runs against local with env exported. Owner should later decide whether
to retire the cloud pointer or apply migrations to that project.

Next owner decision:

- start R2.3 durable approvals (`aio_approvals` table + resolve API +
  resolve-once / expiry rules), or
- pause to commit the verified R2.2 wiring slice first.

Do not push or merge without owner approval.
