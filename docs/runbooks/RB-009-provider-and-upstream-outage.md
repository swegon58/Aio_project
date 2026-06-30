# RB-009: Provider / upstream service outage

**SLOs:** All — force-majeure (excluded from error budget per `SLO.md`)
**Alert:** Supabase unreachable, OpenRouter 5xx/timeout spike, or LM Studio /
model endpoint non-responsive; OR `runs_failed_total{reason=~"hermes_request_failed|provider_*"}`
spike.

## Scope

Aio depends on three upstream planes:

| Upstream | Used for | Health probe |
|---|---|---|
| Supabase | Postgres, Auth/GoTrue, Storage | `GET https://<project-ref>.supabase.co` / dashboard status |
| OpenRouter (or configured model gateway) | Model supply for chat/research | provider status page; `aio_tool_calls` failure rate |
| LM Studio (local model server) | Local model fallback / dev | `GET http://127.0.0.1:1234/v1/models` |

A degradation in any is **force-majeure** and excluded from the error budget via
manual annotation (`SLO.md` §Excluded) — but the product must still fail
**gracefully**, not crash.

## Triage

1. Identify the failing plane:
   - Supabase: `scripts/aio-smoke.sh` (DB-backed endpoints fail); Supabase status
     page; can the app read `aio_runs` / sign in?
   - OpenRouter/gateway: check `aio_tool_calls` for `provider_*` failures; recent
     chat turns failing with model errors.
   - LM Studio: `scripts/aio-smoke.sh` LM Studio check; `journalctl --user -u aio-hermes`.
2. Confirm scope: single user/run vs systemic (rate of failures over 5–10 min).
3. Check whether a graceful fallback path already engaged (`runtime_not_configured`
   / error state in `orchestrateAioChatRun`, or the model-gateway failover).

## Remediation

| Symptom | Action |
|---|---|
| Supabase outage | Wait for recovery (managed service); surface a friendly error in the UI; do **not** retry-spam the DB. Annotate the affected SLO window as force-majeure. |
| OpenRouter/gateway degraded | Switch model route to the local LM Studio fallback if configured; otherwise pause chat/research and show `runtime_not_configured`-style messaging. |
| LM Studio down | Restart LM Studio; `systemctl --user restart aio-hermes.service`; confirm `:1234/v1/models` answers. |
| Key invalid / rate-limited (OpenRouter) | See `RB-007-openrouter-key-usage-stale.md`; rotate per [dependency-cadence.md](../operations/dependency-cadence.md). |
| Auth (GoTrue) down | Sign-in/sign-up fail; surface error, wait for recovery. See `RB-008-auth-failure-spike.md`. |

## Escalation

If the outage is systemic and user-facing, declare a SEV-1/2 per
[incident-response.md](../operations/incident-response.md) and route per
[alert-routing.md](../operations/alert-routing.md). Page the owner for SEV-1.

## Post-incident

- Annotate the force-majeure window in the SLO review (exclude from error budget).
- Post RCA in `#aio-reliability` if user-visible degradation exceeded a few
  minutes.
- If a fallback path was missing or weak, create a follow-up to harden graceful
  degradation for that provider.
- `aio_audit_log` entry with `event_type=provider_outage_detected` (admin category).

## Note — remaining incident gaps

The narrower "abuse spike" and "browser-session failure" incident types do not yet
have dedicated runbooks (RB-010 / RB-011). Triage them ad-hoc via
[incident-response.md](../operations/incident-response.md) +
[support-intake.md](../operations/support-intake.md) until those runbooks exist.
