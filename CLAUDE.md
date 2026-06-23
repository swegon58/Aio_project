# Aio Project

Standalone product: "Aio" (All in One) — AI agent app. Split out of `AI_Autonomous_Project` on 2026-06-23 so it can ship/deploy independently of internal tooling.

## Structure

```
Aio_project/
└── apps/
    ├── web/        ← Next.js frontend (landing + /app chat UI)
    └── harness/    ← Hermes-agent clone (backend brain), isolated via profile "aio" (~/.hermes/profiles/aio)
```

See `apps/web/CLAUDE.md` and `apps/harness/CLAUDE.md` for per-folder details (carried over from the original location, still accurate).

## Dev

- Frontend: `cd apps/web && npm install && npm run dev`
- Backend: see `apps/harness/CLAUDE.md` for hermes-agent profile setup

## Notes

- Restructured 2026-06-23 to standard `apps/` monorepo layout (`Aio/` → `apps/web`, `Aio_harness/` → `apps/harness`).
- `apps/harness/hermes-agent/` was a nested git clone (gitlink) before the fold — stripped to plain tracked files so the whole tree lives in one repo, `github.com/swegon58/Aio_project`.
- `~/.hermes/profiles/aio` is outside this repo and unaffected by the folder move.
