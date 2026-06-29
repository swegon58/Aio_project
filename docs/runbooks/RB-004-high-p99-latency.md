# RB-004: Chat turn P99 latency breach

**SLO:** SLO-02 (P99 ≤ 30 s)  
**Alert:** `aio.chat_turn_latency_ms` p99 > 30 000 over a 1-hour window

## Triage

1. Check `aio.hermes_start_latency_ms` — is latency originating in session start or streaming?
2. Check Hermes model size: a 70B model on constrained VRAM will have high TTFT.
3. Check `aio_runs.completed_at - created_at` distribution — identify outliers by mode/tier.

```sql
SELECT
  mode,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY
    EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000
  ) AS p50_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY
    EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000
  ) AS p99_ms
FROM aio_runs
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY mode;
```

## Remediation

| Root cause | Action |
|---|---|
| Model inference slow | Switch to a faster model via Hermes profile; or reduce context window cap |
| Knowledge retrieval slow | Check `buildKnowledgeContext` timing; disable RAG for the spike window |
| Hermes VRAM exhaustion | Restart Hermes with a smaller model; or reduce max concurrent sessions |
| Budget check HTTP call slow | Check OpenRouter usage endpoint latency; bump the check interval |

## Post-incident

Review whether `wallClockTimeoutMs` cap is appropriate for the affected mode.
Update SLO targets if P99 is consistently above threshold for the current model family.
