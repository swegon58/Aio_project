# RB-002: Credit settlement lag / runs stuck in running

**SLO:** SLO-07 (100% of completed runs settled)  
**Alert:** `aio_runs` rows with `status=running` for > 10 min AND `completed_at IS NULL`

## Triage

```sql
-- Find stuck runs
SELECT id, user_id, status, created_at, hermes_run_id
FROM aio_runs
WHERE status = 'running'
  AND created_at < NOW() - INTERVAL '10 minutes';
```

1. Check if the Hermes stream completed but the settlement callback failed.
2. Check Vercel function logs for `markTerminal` / `settleTask` errors on the relevant run.
3. Verify OpenRouter key usage endpoint is reachable: check `OPENROUTER_API_KEY` validity.

## Remediation

| Case | Action |
|---|---|
| Settlement threw → run stuck | Manually run `markTerminal(runId, userId, 'failed', { errorCode: 'settlement_error' })` via Supabase SQL or admin script |
| OpenRouter key invalid | Rotate key, redeploy; stuck runs refund via the next credit reconciliation job (R4) |
| Supabase RPC error | Check Supabase status; retry after recovery — the `markTerminal` path is idempotent |

## Prevention

- Add a scheduled job (cron, R4.7 scope) that finds runs older than 15 min
  still in `running` and force-closes them with `client_aborted`.
- Watch `aio.runs_completed_total` vs `aio.runs_started_total` on the same
  24 h window — sustained divergence signals a settlement leak.

## Post-incident

Reconcile stuck rows in Supabase and log in `#aio-reliability`.
