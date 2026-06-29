# RB-005: Supabase / Postgres connection exhaustion

**Alert:** HTTP 500s with `supabase_error: too many connections` OR `pgrst` errors on run/approval writes

## Triage

1. Check Supabase dashboard → Database → Connection pool usage.
2. Identify top connection holders:
```sql
SELECT client_addr, count(*), state
FROM pg_stat_activity
GROUP BY client_addr, state
ORDER BY count DESC
LIMIT 20;
```
3. Check for long-running queries blocking connections:
```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

## Remediation

| Cause | Action |
|---|---|
| Long-running run writes | Terminate idle long-running queries via `SELECT pg_terminate_backend(pid)` |
| Vercel function connection leak | Redeploy Next.js to reset Vercel edge connections |
| Supabase pool saturated | Enable PgBouncer in Supabase dashboard (transaction mode) |

## Prevention

- All DB calls in this repo use the Supabase client (connection pooled by default in Vercel).
- Never hold a connection across a Hermes SSE stream — all DB writes are discrete, not long-lived.
- Use `serviceDb()` (not `createClient()`) for server-to-server writes to avoid auth overhead per call.

## Post-incident

After recovery, verify `aio_runs` stuck in `running` (see RB-002) and manually close them.
