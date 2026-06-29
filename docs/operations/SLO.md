# Aio Service Level Objectives (SLOs)

**Owner:** Product  
**Last reviewed:** 2026-06-29  
**Review cadence:** Monthly or after any SLO breach event

---

## Scope

These SLOs cover the Aio consumer product (apps/web + Hermes runtime). They
are measured on rolling 30-day windows in production. Breaches auto-page the
on-call rotation via the alert rules in `docs/operations/alert-routing.md`.

---

## SLO Table

| ID | Signal | Target | Error budget (30 d) | Measurement |
|---|---|---|---|---|
| SLO-01 | Chat turn P50 latency ≤ 8 s | 95% of turns | 36 h | `aio.chat_turn_latency_ms` histogram |
| SLO-02 | Chat turn P99 latency ≤ 30 s | 99% of turns | 7.2 h | `aio.chat_turn_latency_ms` histogram |
| SLO-03 | Hermes session start ≤ 3 s | 99% of starts | 7.2 h | `aio.hermes_start_latency_ms` histogram |
| SLO-04 | Run completion rate | ≥ 97% | 21.6 h | `runs_completed / (runs_completed + runs_failed)` |
| SLO-05 | Approval response rate | ≥ 99% of approvals resolved within 5 min | — | `aio_approvals.resolved_at - created_at` |
| SLO-06 | API error rate (5xx) | ≤ 1% of chat requests | — | HTTP response codes on `/api/chat` |
| SLO-07 | Credit settlement accuracy | 100% of completed runs settled | — | `aio_runs` completed with `actual_credits IS NOT NULL` |

---

## Burn-Rate Alerts

Alert when the error budget burns faster than the window allows. Two windows:

| Window | Burn-rate threshold | Severity |
|---|---|---|
| 1 h | > 14× | Page immediately |
| 6 h | > 6× | Page within 30 min |
| 1 d | > 3× | Slack notify |

---

## Excluded from SLOs

- Background jobs (knowledge ingestion, research pipeline stages) — tracked
  separately as pipeline SLOs (R4).
- Developer / preview environments — not production traffic.
- Force-majeure: Supabase outages, OTel exporter failures, upstream provider
  (OpenRouter, Claude) degradation — excluded from error budget via manual
  annotation.

---

## SLO Review Process

1. Pull the 30-day burn chart from Grafana `aio-slo` dashboard.
2. Identify any SLO missed by > 10% of budget.
3. Post a brief RCA in `#aio-reliability` (Slack).
4. Update the relevant runbook if the root cause was a known incident type.
