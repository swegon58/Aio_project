# RB-008: Auth / provisioning failure spike

**Alert:** `resolveHermesRequestContext` returning `ok: false` for > 5% of chat requests  
**Symptom:** Users see "runtime_not_configured" error or are unexpectedly redirected to login

## Triage

1. Check Supabase Auth dashboard — is `auth.users` accessible? Is the JWT secret unchanged?
2. Check `hermes_registry` rows for the affected users:
```sql
SELECT user_id, endpoint, plan_tier, updated_at
FROM hermes_registry
WHERE updated_at < NOW() - INTERVAL '1 hour'
LIMIT 10;
```
3. Check if `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars are set correctly on Vercel.

## Remediation

| Cause | Action |
|---|---|
| Supabase JWT secret rotated | Redeploy Vercel with updated `SUPABASE_JWT_SECRET` |
| `hermes_registry` row missing | Auto-provision fires on next chat; if blocked, trigger `POST /api/dev/provision` |
| Endpoint URL wrong after Hermes restart | Update `endpoint` in `hermes_registry` for affected users |
| Session cookie expired | User must re-login — this is expected, not an incident |

## Prevention

- `resolveHermesRequestContext` already fails fast with a structured error — no user data is exposed.
- Consider adding a `/api/health` endpoint that probes DB connectivity and the Hermes endpoint in < 500 ms (R5 scope).

## Post-incident

If the JWT secret was unintentionally rotated, all sessions are invalidated — send a product notice.
Log in `aio_audit_log` with `event_type=auth_failure_spike` (admin category).
