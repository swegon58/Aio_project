# ADR-002: Telemetry and Retention

**Status:** Accepted  
**Date:** 2026-06-29  
**Deciders:** Product owner

---

## Context

Aio needs to identify why a run failed, slowed down, or became expensive before
the user reports it. The solution must not lock business logic to a specific
telemetry vendor, must not exfiltrate PII or secrets, and must work in local
development without external dependencies.

---

## Decision

### SDK and Exporter

- **Primary SDK:** OpenTelemetry (OTel) — vendor-neutral traces, metrics, spans
- **Local dev:** `@opentelemetry/sdk-trace-base` with in-memory/console exporter  
- **Production exporter:** OTLP over HTTP (compatible with Grafana Cloud, Honeycomb, or self-hosted Alloy/Tempo)
- **Langfuse adapter:** optional; wired via OTel-compatible SDK (`langfuse-vercel`) for LLM-specific spans — loaded only when `LANGFUSE_SECRET_KEY` is set
- Business logic imports only the Aio telemetry interface (`@/lib/aio/telemetry`), never a provider SDK directly

### PII / Redaction Boundary

The following **never** appear in span attributes, metric labels, or log lines:
- Raw prompt text or completions
- Auth tokens, API keys, cookies, session IDs
- Email addresses, names, or free-text user content
- Full file paths containing user data

Safe to include:
- Stable, opaque IDs (run_id, user_id, tool_call_id, approval_id)
- Enumerated values (model name, tool name, risk level, status)
- Numeric measurements (token count, latency ms, cost in micro-units)
- Stable failure reason codes (no stack traces or error messages in attributes)

### Sampling

| Environment | Strategy |
|---|---|
| Local dev | 100% trace, no export |
| Staging | 100% trace, OTLP export |
| Production | Head-based 10% for normal chat turns; 100% for errors, approvals, and billing events |

Sampling config lives in `OTEL_SAMPLE_RATE` env var; code never hard-codes 0 or 1.

### Trace / Log / Metric Retention

| Signal | Retention |
|---|---|
| Traces | 30 days (errors: 90 days) |
| Metrics | 13 months rolling |
| Structured logs | 30 days |
| Audit log (aio_audit_log) | Indefinite, owner-readable |

### Local Development

- Zero configuration to start: if no `OTEL_EXPORTER_OTLP_ENDPOINT` is set, telemetry is a no-op (no errors, no noise)
- `OTEL_DEBUG=true` enables a pretty-print console span exporter for local tracing

### Provider Outage Fallback

- Telemetry export is fire-and-forget; a failed export **never** blocks or errors the primary operation
- Exporter uses a background queue with a 2-second timeout; dropped spans are counted in a local counter, not retried

---

## Consequences

- OpenTelemetry adds ~40KB to the server bundle (tree-shaken); acceptable
- Langfuse adapter is optional; teams without an LLM observability budget get OTel-only coverage
- Redaction boundary must be enforced in code review — no automated enforcement yet (deferred to R6)
- Retention times are initial targets; adjust based on storage cost after first billing cycle
