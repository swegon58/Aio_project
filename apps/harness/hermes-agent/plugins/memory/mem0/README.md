# Mem0 Memory Provider

Server-side LLM fact extraction with semantic search, reranking, and automatic deduplication.

Two deployment modes, selected via `mode` (`MEM0_MODE`):

- **platform** (default) — Mem0 Platform API (hosted, needs an API key).
- **self_hosted** — Mem0 OSS against your own Postgres + pgvector. Evaluation
  track alongside the Honcho provider: free, no vendor API key, no new
  vector DB to stand up if you already run Postgres with the `pgvector`
  extension enabled.

## Requirements

- `pip install mem0ai`
- Platform mode: Mem0 API key from [app.mem0.ai](https://app.mem0.ai)
- Self-hosted mode: `pip install 'psycopg[binary,pool]'`, plus a Postgres
  database with the `pgvector` extension enabled (`CREATE EXTENSION vector;`)

## Setup

```bash
hermes memory setup    # select "mem0"
```

Or manually (platform mode):
```bash
hermes config set memory.provider mem0
echo "MEM0_API_KEY=your-key" >> ~/.hermes/.env
```

Or manually (self-hosted mode):
```bash
hermes config set memory.provider mem0
echo "MEM0_MODE=self_hosted" >> ~/.hermes/.env
echo "MEM0_PG_DSN=postgresql://user:pass@host:5432/dbname" >> ~/.hermes/.env
```

## Config

Config file: `$HERMES_HOME/mem0.json`

| Key | Default | Description |
|-----|---------|-------------|
| `mode` | `platform` | `platform` or `self_hosted` |
| `api_key` (env `MEM0_API_KEY`) | — | Platform mode only |
| `pg_connection_string` (env `MEM0_PG_DSN`) | — | Self-hosted mode only; Postgres DSN |
| `pg_collection` (env `MEM0_PG_COLLECTION`) | `mem0` | Self-hosted mode only; pgvector collection name |
| `user_id` | `hermes-user` | User identifier on Mem0 |
| `agent_id` | `hermes` | Agent identifier |
| `rerank` | `true` | Enable reranking for recall |

## Tools

| Tool | Description |
|------|-------------|
| `mem0_profile` | All stored memories about the user |
| `mem0_search` | Semantic search with optional reranking |
| `mem0_conclude` | Store a fact verbatim (no LLM extraction) |
