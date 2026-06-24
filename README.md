# Aio

Aio ("All in One") is an AI agent app: a chat-driven workspace where each user gets a
dedicated agent backend (sandboxed terminal, memory, file/code tools) behind a normal
web frontend.

The repo is a monorepo with two apps that are developed and deployed independently:

```
Aio_project/
└── apps/
    ├── web/        Next.js frontend — landing page + authenticated /app chat UI
    └── harness/    Hermes-agent backend — one process per customer ("profile")
```

## Architecture

- **apps/web** is a normal Next.js app. It serves the marketing site, handles auth
  (Supabase), billing/credits, and the `/app` chat UI. It talks to the backend over
  HTTP/SSE — it never runs agent code itself.
- **apps/harness** wraps [hermes-agent](https://github.com/NousResearch/hermes-agent)
  (Python, MIT licensed, pinned upstream). Each customer gets an isolated "profile":
  its own port, `state.db`, and `.env`. The dev profile is called `aio`. Hermes
  exposes an OpenAI-style `/v1/chat/completions` endpoint that `apps/web` proxies to.

```
Browser → apps/web (Next.js) → Hermes gateway (per-profile) → sandboxed tools
                                       (terminal, files, memory, browser)
```

See [apps/web/README.md](apps/web/README.md) and [apps/harness/README.md](apps/harness/README.md)
for the full detail on each app — this file only covers what's shared.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Auth / DB | Supabase (Postgres, Auth, Storage) |
| Streaming | Vercel AI SDK (SSE) |
| Backend agent | Python, hermes-agent, profile-per-customer |
| Sandbox | Daytona (terminal/code execution) |
| Memory | Honcho |
| Dev model | LM Studio (local), OpenRouter (fallback) |

## Getting started

### Frontend

```bash
cd apps/web
npm install
cp .env.local.example .env.local   # fill in Supabase + Hermes keys
npm run dev                        # http://localhost:3000
```

### Backend (Hermes, profile "aio")

```bash
cd apps/harness/hermes-agent
uv venv && uv pip install -e .
```

```bash
HERMES_HOME=$(pwd)/../aio-home \
HOME=$(pwd)/../aio-home/profiles/aio/home \
hermes -p aio gateway run --replace
```

Both `HERMES_HOME` and `HOME` are required — `HERMES_HOME` points at the profile
root, `HOME` sandboxes any `~/...` path the agent writes to. Full setup, gotchas,
and the idle-kill/crash-reconcile supervisor are documented in
[apps/harness/README.md](apps/harness/README.md).

## Environment variables

- `apps/web/.env.local.example` — Supabase keys, `HERMES_DEV_API_SERVER_KEY`
- `apps/harness/aio-home/profiles/aio/.env` — `API_SERVER_KEY`, `HONCHO_API_KEY`,
  model provider credentials

Never touch `~/.hermes/` — that's an unrelated profile on this machine. All Aio
Hermes profiles live under `apps/harness/aio-home/`.

## Status

- Landing page and `/app` chat UI: live
- Hermes backend wired end-to-end (streaming, memory, sandboxed terminal)
- Credit/billing endpoints in place, payment provider (Paddle) not yet live
- Per-customer secret vaulting deferred — profiles currently share a `.env`

## History

Split out of a larger internal monorepo on 2026-06-23 into this standalone repo
(`Aio/` → `apps/web`, `Aio_harness/` → `apps/harness`) so it can ship and deploy on
its own.
