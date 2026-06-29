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
- R2.3 is complete and verified: `aio_approvals` (migration `0013`) holds the
  approval lifecycle; `approval-state-machine.ts` + `approval-repository.ts`
  (request/get/list/resolve + lazy expiry sweep) own it; `recordApprovalEvent`
  is wired into the run orchestrator right after `recordToolCallEvent`
  (`approval.requested`→request, `approval.responded`→resolve-once); server
  APIs `GET /api/runs/[runId]/approvals` and
  `POST /api/runs/[runId]/approvals/[approvalId]/resolve` expose reads +
  canonical resolution. typecheck clean, `test:unit` 65/65, eslint clean, live
  `scripts/r2-3-approval-probe.ts` (11/11) against local Supabase stack.
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

- [x] Add `aio_approvals` migration (`0013_aio_approvals.sql`, RLS select-only)
- [x] Add approval state machine + repository (snapshot risk, redacted request, TTL)
- [x] Add approval read/resolve server APIs (`GET .../approvals`, `POST .../resolve`)
- [x] Wire `recordApprovalEvent` into run orchestrator (mirrors `recordToolCallEvent`)
- [x] Enforce resolve-once, idempotent replay, and expiry rules (lazy + bulk sweep)
- [x] Verified: `npm run typecheck`, `npm run test:unit` (65/65), eslint clean, live `scripts/r2-3-approval-probe.ts` (11/11) against local Supabase stack

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

R2.3 is complete and verified (state machine + repository + writer wiring +
server APIs + unit tests + live probe all green). The full R2.3 slice is
uncommitted in the working tree on `feat/r2-tool-governance-foundation`:

- `0013_aio_approvals.sql` (applied to local stack, verified 20 cols + RLS)
- `approval-state-machine.ts` + `.test.ts`
- `approval-repository.ts`
- `approval-writer.ts` + `.test.ts`
- `run-orchestrator.ts` wiring (import + one `recordApprovalEvent` call)
- `run-api.ts` (`serializeApproval`)
- `api/runs/[runId]/approvals/route.ts` (GET list)
- `api/runs/[runId]/approvals/[approvalId]/resolve/route.ts` (POST resolve)
- `scripts/r2-3-approval-probe.ts` (11/11)

Environment note: `.env.local` (main worktree) points at a cloud Supabase
project (`xeuvoaedwdmuhxdcoxcx`) that was never migrated — every Aio table
404s there. The real dev DB is the local Docker stack (kong on `:54321`,
public demo keys), where all migrations through `0013` are applied. The R2.3
probe runs against local with env exported (service_role JWT read from kong.yml).
Owner should later decide whether to retire the cloud pointer or apply
migrations to that project.

Next owner decision:

- commit the verified R2.3 slice, then
- start R2.4 Approval UI (replace live-only approval card assumptions with
  durable approval reads; show requested/resolved/expired states in the run
  timeline), or
- skip ahead to R2.5 Mandatory Policies (enforce default approval requirements
  from the manifest/policy layer; block dangerous execution paths lacking a
  durable approval row).

Do not push or merge without owner approval.
