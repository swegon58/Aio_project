# Incident response

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30

How Aio classifies and handles incidents. Severity routing lives in
[alert-routing.md](./alert-routing.md); this document defines the severity levels,
roles, and the post-incident review process referenced by `SLO.md`
("Post RCA in `#aio-reliability`").

## Severity definitions

| Severity | Definition | Examples |
|---|---|---|
| **SEV-1** | Production down or major user-facing breakage; data loss / billing error. | App or Hermes unreachable; chat fully broken; credits mis-settled at scale; auth down. |
| **SEV-2** | Significant degradation; SLO budget burning fast (6 h > 6×). | P99 latency sustained > 30 s; approval queue stuck; a single provider path failing with no graceful fallback. |
| **SEV-3** | Minor / limited impact; slow burn (1 d > 3×) or isolated bug. | Sporadic 5xx below threshold; one MCP tool flaky; non-critical background job lagging. |

Force-majeure (Supabase outage, upstream model/provider degradation, OTel exporter
failure) is **excluded** from the error budget via manual annotation — see
`SLO.md` and `RB-009-provider-and-upstream-outage.md`.

## Roles

| Role | Responsibility | Default |
|---|---|---|
| Incident commander (IC) | Coordinates response, owns the timeline, declares resolved | `@swegon58` |
| Responder | Executes the runbook / fix | `@swegon58` |
| Comms | Status updates to users (if user-facing) | `@swegon58` |

Single-owner today — one person holds all three roles.

## Lifecycle

1. **Detect** — alert (per [alert-routing.md](./alert-routing.md)) or user report
   (per [support-intake.md](./support-intake.md)). Assign a severity.
2. **Triage** — follow the matched runbook (SLO→runbook table in alert-routing).
3. **Mitigate** — restore service first (rollback / restart / graceful degrade);
   root-cause second.
4. **Resolve** — confirm via `scripts/aio-smoke.sh` + spot-check; declare resolved.
5. **Post-incident** — within 2 business days for SEV-1/2:
   - Post a brief RCA in `#aio-reliability` (Slack) — see template below.
   - Update the relevant runbook if the root cause was a known/now-known incident type.
   - Create follow-up issues for the real fix (avoid repeat mitigation).

## RCA template

```markdown
## RCA — <short title> — <date>
- **Severity:** SEV-?
- **Impact:** <users/requests affected, duration>
- **SLOs affected:** <SLO-xx>
- **Timeline:** <detect → mitigate → resolve, with times>
- **Root cause:** <technical cause>
- **Trigger:** <what started it>
- **What went well / poorly:** <response notes>
- **Action items:** <issues + owners> — update runbook <RB-xxx>
```

Record SEV-1/2 RCAs (or a pointer to the Slack thread) in `AIO_PROJECT_STATE.md`.

## Related

- [alert-routing.md](./alert-routing.md) — severity→channel and SLO→runbook mapping.
- [support-intake.md](./support-intake.md) — how user reports become incidents.
- `docs/runbooks/` — runbooks to execute during triage.
