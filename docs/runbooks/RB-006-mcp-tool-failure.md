# RB-006: MCP tool call failures spike

**Alert:** `aio.tool_calls_failed_total{tool="mcp"}` > 5/min  
**Audit:** Check `aio_audit_log` for `event_type=mcp.tool_call` with `outcome=error`

## Triage

1. Identify which MCP server is failing:
```sql
SELECT context->>'serverName', context->>'toolName', count(*)
FROM aio_audit_log
WHERE event_type = 'mcp.tool_call'
  AND outcome = 'error'
  AND occurred_at > NOW() - INTERVAL '1 hour'
GROUP BY 1, 2
ORDER BY 3 DESC;
```
2. Check the MCP server process on the harness host: `ps aux | grep mcp`
3. Check the Hermes profile MCP config: `~/.claude/profiles/aio` (never edit directly — copy and restart).

## Remediation

| Cause | Action |
|---|---|
| MCP server process down | Restart via Hermes profile or systemd unit |
| MCP auth token expired | Rotate the relevant token in credentials (via Aio Credentials UI, R2 scope) |
| Tool call schema mismatch | Disable the specific MCP tool in the profile until fixed |
| Rate limited by upstream | Add exponential back-off in the MCP adapter (file a fix) |

## Post-incident

If a user ran an MCP tool that failed mid-run, their run may be stuck. See RB-002.
Log MCP outage duration in `#aio-reliability`.
