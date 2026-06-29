# RB-007: OpenRouter usage endpoint returning stale / error data

**Alert:** `settleTask` calls logging `usage_delta=null` for > 20% of completed runs  
**Impact:** Over-refund (reserved credits fully refunded instead of settling actual usage)

## Triage

1. Manually query the OpenRouter usage endpoint:
```bash
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/auth/key
```
2. Check for `limit_remaining`, `usage`, `is_free_tier` fields — if missing or 0, the key is saturated or invalid.
3. Check Vercel logs for `fetchOpenRouterKeyUsage` errors.

## Remediation

| Cause | Action |
|---|---|
| Key rate-limited | Wait; or rotate to a secondary key via Hermes profile |
| Key over-limit | Top up OpenRouter credits; rotate key if over-used by a bad actor |
| Usage API down | Settlement falls back to refund (safe — no over-charge). Monitor and retry. |

## Prevention

- `actualCostCreditsFromUsageDelta` already returns `estimate` as a fallback when usage data is unavailable — users are never over-charged.
- Add a 24-hour sanity check job that compares reserved vs. settled totals and logs large gaps to `aio_audit_log` (R4 scope).

## Post-incident

If the key was compromised, rotate immediately and invalidate any sessions sharing the key.
