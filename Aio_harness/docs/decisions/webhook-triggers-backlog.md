# Webhook/event-triggered automations — backlog (2026-06-21)

Hermes core already supports automation triggers beyond cron
(`hermes-already-has-routines.md`): GitHub webhook subscriptions and
generic API-triggered runs (HMAC-authed POST → agent run → deliver).
Aio currently only exposes **cron** scheduled tasks in the Activity tab.

## Why it's backlog, not next sprint

Same "needs a UI/API surface first" situation as moa/computer_use/file-browser:
- Hermes' webhook subscribe is a CLI/profile-level primitive
  (`hermes webhook subscribe <name> --events ... --prompt ... --deliver ...`).
  Aio has no per-customer route to create/list/delete these yet, no UI for
  "trigger type" (cron vs webhook vs API), and no per-tenant webhook URL
  issuance/auth story (Phase-1 constraint: no hermes-agent core edits).
- Script-injection pre-processing (`--script`) is dev-facing, not prosumer/SMB
  — likely never surfaces in Aio's UI even if webhooks ship.

## Recommended shape, when picked up
Extend the existing cron-task UI/API pattern (`/api/cron/*`,
`AppHome.tsx` scheduled-tasks panel) with a "trigger type" selector:
cron (today) vs webhook (new). Webhook case needs a tenant-scoped
inbound URL the gateway can route to the right profile — check whether
the relay/connector webhook "passthrough plane" (`gatewayEndpoint`,
`relay-connector-contract.md` §3 note) already covers Class-2/3 webhooks
generically before building anything bespoke.

## Status
Backlog. Do not half-wire (e.g. don't add a "webhook" option in the UI
that silently does nothing).
