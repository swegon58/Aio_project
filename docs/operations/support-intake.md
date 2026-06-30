# Support intake

**Owner:** `@swegon58`
**Support owner (named, R6.8):** swegon58 — `swegon58@gmail.com`
**Last reviewed:** 2026-06-30

How user-reported issues are captured, triaged, and routed. The user-facing
**support channel** (in-app feedback, email, Intercom) is **owner-gated** — this
document defines the intake + triage process and the classification routing; the
channel itself is a placeholder until chosen (paid/managed tooling requires owner
approval). The named support owner above is the single point of contact for
beta — this assignment does not require a dedicated channel to be active.

## Intake channels

| Source | Status | Notes |
|---|---|---|
| In-app error surfaces (`runtime_not_configured`, `insufficient_credits`, etc.) | Active | Errors are user-visible and telemetry-captured (`aio_*` metrics / audit log) |
| Direct report to owner | Active | Email: `swegon58@gmail.com` |
| External support tool (Intercom/email) | **Owner-gated** | Placeholder; not provisioned |

## Triage flow

1. **Capture** — record the report: what the user saw, when, which account/run,
   repro steps. Attach the relevant `aio_runs` / `hermes_conversations` id if known.
2. **Reproduce** — attempt locally or against the live stack (`scripts/aio-smoke.sh`
   for health; sign-in flow for product bugs).
3. **Classify** into one of:

   | Class | Route to |
   |---|---|
   | Bug (product) | GitHub issue; fix via normal PR flow |
   | SLO breach / outage | [incident-response.md](./incident-response.md) + matched runbook |
   | Abuse / trust (rate-limit, AUP) | `aio_audit_log` + owner review; raise severity if systemic |
   | Billing / credits | Investigate `aio_runs.actual_credits` + Paddle; treat as SEV-1 if mis-settled at scale |
   | How-to / question | Answer; candidate for docs/FAQ |

4. **Acknowledge** — respond to the user on the originating channel; set
   expectation (fix vs. follow-up).
5. **Close the loop** — when fixed, confirm with the reporter if identifiable.

## Privacy guardrail

Support handling may surface user data. Use the R6.5 account-export
(`GET /api/account/export`) only for the affected user when needed; never bulk-export
or share raw rows outside the owner. PII redaction follows `ADR-002` (telemetry &
retention).

## Related

- [incident-response.md](./incident-response.md) — when an intake item escalates.
- [alert-routing.md](./alert-routing.md) — severity routing.
- `docs/security/aio-tool-risk-register.md` — abuse/trust classification.
