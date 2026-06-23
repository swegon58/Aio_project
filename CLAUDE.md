# Aio Project

Standalone product: "Aio" (All in One) — AI agent app. Split out of `AI_Autonomous_Project` on 2026-06-23 so it can ship/deploy independently of internal tooling.

## Structure

```
Aio_project/
├── Aio/             ← Next.js frontend (landing + /app chat UI)
└── Aio_harness/     ← Hermes-agent clone (backend brain), isolated via profile "aio" (~/.hermes/profiles/aio)
```

See `Aio/CLAUDE.md` and `Aio_harness/CLAUDE.md` for per-folder details (carried over from the original location, still accurate).

## Dev

- Frontend: `cd Aio && npm install && npm run dev`
- Backend: see `Aio_harness/CLAUDE.md` for hermes-agent profile setup

## Notes

- `Aio/` has no independent git history yet — it was flattened into the parent monorepo before the split. Currently untracked here; original still lives in `AI_Autonomous_Project`.
- `Aio_harness/` keeps its own git repo, remote now points to `github.com/swegon58/Aio_project`.
- `~/.hermes/profiles/aio` is outside this repo and unaffected by the folder move.
