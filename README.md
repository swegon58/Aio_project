# Aio

Aio ("All in One") — AI agent app. Standalone product, split out of `AI_Autonomous_Project` so it can ship/deploy independently of internal tooling.

## Structure

```
Aio_project/
├── apps/
│   ├── web/        ← Next.js frontend (landing page + /app chat UI)
│   └── harness/     ← Hermes-agent clone (backend brain), isolated via profile "aio" (~/.hermes/profiles/aio)
├── config/          ← wrapper scripts (Discord bot launcher, etc.)
├── tools/           ← misc scripts (e.g. discord_live_update.py)
└── .claude/         ← Claude Code config: rules, hooks, Discord channel state
```

See `apps/web/CLAUDE.md` and `apps/harness/CLAUDE.md` for per-app details.

## Dev

- Frontend: `cd apps/web && npm install && npm run dev`
- Backend: see `apps/harness/CLAUDE.md` for hermes-agent profile setup

## Notes

- `apps/harness/hermes-agent/` is tracked as plain files (not a git submodule).
- `~/.hermes/profiles/aio` lives outside this repo and is unaffected by repo moves.
