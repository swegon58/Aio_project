# RB-001: Hermes session start failures spike

**SLO:** SLO-03 (Hermes session start ≤ 3 s, 99%)  
**Alert:** `aio.hermes_start_latency_ms` p99 > 3000 OR `runs_failed_total{reason="hermes_request_failed"}` > 5/min

## Triage

1. Check `aio.hermes_start_latency_ms` histogram — is it timeout (≈wallClock cap) or fast-fail?
2. `systemctl status hermes` on the harness host — is the process running?
3. Check harness logs: `journalctl -u hermes -n 100 --no-pager`
4. Ping `GET /health` on the Hermes endpoint directly (requires `AIO_API_SERVER_KEY`).

## Remediation

| Symptom | Action |
|---|---|
| Process not running | `systemctl restart hermes` |
| OOM / out of VRAM | Reduce concurrent runs; restart with lower model size |
| Port conflict | Check `lsof -i :PORT`; restart after resolving conflict |
| API key invalid | Rotate `AIO_API_SERVER_KEY` in env and redeploy |

## Escalation

If restarts don't resolve in 10 min, page the owner and switch consumer UI to
the `runtime_not_configured` error state (already graceful in `orchestrateAioChatRun`).

## Post-incident

- Create an `aio_audit_log` entry with `event_type=hermes_outage_detected` (admin category).
- Review whether the timeout threshold (`wallClockTimeoutMs`) needs adjustment.
