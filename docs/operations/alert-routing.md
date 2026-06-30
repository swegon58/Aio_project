# Alert routing

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30

`SLO.md` defines seven SLOs with burn-rate alerts that "auto-page the on-call
rotation via the alert rules in this file." This document defines that routing:
who is paged, on which severity, and which runbook each alert maps to.

> **Transport is owner-gated.** No external paging/Slack SaaS is wired today. The
> severity→channel mapping below is the contract; the channels themselves (Slack
> webhook, PagerDuty, etc.) are placeholders until the owner provisions them.
> Until then, breaches are detected via the metrics in `SLO.md` reviewed on the
> monthly cadence.

## On-call rotation

| Role | Who | Contact |
|---|---|---|
| Primary on-call | `@swegon58` | _<owner: fill — phone / Slack / email>_ |
| Escalation | `@swegon58` | _<owner: fill>_ |

Single-owner rotation today. When a second operator joins, define a primary /
secondary rotation here.

## Severity → channel

Aligned to the burn-rate windows in `SLO.md`:

| Severity | Trigger | Target channel | Response window |
|---|---|---|---|
| **SEV-1** | 1 h burn-rate > 14× | Page immediately (primary on-call) | Now |
| **SEV-2** | 6 h burn-rate > 6× | Page primary on-call | Within 30 min |
| **SEV-3** | 1 d burn-rate > 3× | Slack `#aio-reliability` notify | Next business hour |
| **Info** | Single missed measurement, no budget breach | Slack `#aio-reliability` | Review monthly |

See [incident-response.md](./incident-response.md) for full SEV definitions and
the incident lifecycle.

## SLO → alert → runbook

| SLO | Signal | Runbook |
|---|---|---|
| SLO-01 / SLO-02 | Chat turn P50 ≤ 8 s / P99 ≤ 30 s | `RB-004-high-p99-latency.md` |
| SLO-03 | Hermes session start ≤ 3 s | `RB-001-hermes-session-down.md` |
| SLO-04 | Run completion rate ≥ 97% | `RB-002-credit-settlement-lag.md` |
| SLO-05 | Approval response ≥ 99% within 5 min | `RB-003-approval-expiry-spike.md` |
| SLO-06 | API 5xx rate ≤ 1% on `/api/chat` | Infra-wide → `RB-005-db-connection-exhaustion.md`, `RB-008-auth-failure-spike.md`, or [incident-response.md](./incident-response.md) |
| SLO-07 | Credit settlement 100% | `RB-002-credit-settlement-lag.md` |

Cross-cutting runbooks (not bound to a single SLO): `RB-006-mcp-tool-failure.md`,
`RB-007-openrouter-key-usage-stale.md`, and `RB-009-provider-and-upstream-outage.md`
(force-majeure / upstream degradation — excluded from error budget per `SLO.md`).

## Review

Update this file when: a new runbook is added, an SLO target changes, or the
on-call rotation / transport changes. Reviewed on the monthly SLO cadence.

## Related

- `SLO.md` — the SLO table and burn-rate windows this file routes.
- [incident-response.md](./incident-response.md) — SEV definitions and RCA process.
- `docs/runbooks/` — the RB-* runbooks referenced above.
