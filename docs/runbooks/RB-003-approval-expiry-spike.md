# RB-003: Approval expiry rate spike

**SLO:** SLO-05 (≥ 99% of approvals resolved within 5 min)  
**Alert:** `aio_approvals` expired count > 10% of `total` in a 1-hour window

## Triage

1. Check the approval UI — is the `ApprovalCard` rendering for users?
2. Check the approval notification path — are push/sound alerts firing?
3. Check `aio_approvals` TTL: default is 5 min; if Hermes sends a short TTL the card may expire before the user sees it.

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'expired') AS expired,
  COUNT(*) AS total,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_resolve_s
FROM aio_approvals
WHERE created_at > NOW() - INTERVAL '1 hour';
```

## Remediation

| Cause | Action |
|---|---|
| UI not showing ApprovalCard | Check `RunEventItem.tsx` event type routing; verify `approval.requested` events reach `AppHome` |
| TTL too short | Extend `ttl_seconds` on Hermes approval config (harness profile aio) |
| User notifications off | Prompt user to enable browser notifications in Settings |

## Post-incident

If expiry rate > 50% in a window, temporarily disable the TTL (set to 24 h)
and file a UI fix for the blocking path. Log in `aio_audit_log` with
`event_type=approval_expiry_spike`.
