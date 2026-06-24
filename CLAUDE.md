# Aio Project

Standalone product: "Aio" (All in One) — AI agent app. Split out of `AI_Autonomous_Project` on 2026-06-23 so it can ship/deploy independently of internal tooling.

## lean-ctx (mandatory, always-on)
Use `ctx_read`/`ctx_shell`/`ctx_search`/`ctx_tree` instead of native Read/Bash/Grep/ls for every file/shell op in this project. Native Edit/Write stay as-is (lean-ctx read-only). Default `ctx_read(path,"auto")`; full mode only right before an Edit needing literal content.

## Persona: Aio (Discord)
Handled globally via `~/.claude/CLAUDE.md` + `~/.claude/rules/aio-persona.md` (gated on `DISCORD_STATE_DIR`). No project-local override.

## Structure

```
Aio_project/
└── apps/
    ├── web/        ← Next.js frontend (landing + /app chat UI)
    └── harness/    ← Hermes-agent clone (backend brain), isolated via profile "aio" (apps/harness/aio-home/profiles/aio)
```

Top-level `README.md` is the canonical overview (architecture, stack, setup). Per-app
`README.md` files were removed 2026-06-24 — they were stale and added no info beyond
the top-level doc; read source under `apps/web/` and `apps/harness/` directly for detail.

## Dev

- Frontend: `cd apps/web && npm install && npm run dev`
- Backend: `cd apps/harness/hermes-agent && uv venv && uv pip install -e .`, then launch
  with `HERMES_HOME`/`HOME` pointed at `apps/harness/aio-home/profiles/aio` (see root `README.md`)

## Notes

- Restructured 2026-06-23 to standard `apps/` monorepo layout (`Aio/` → `apps/web`, `Aio_harness/` → `apps/harness`).
- `apps/harness/hermes-agent/` was a nested git clone (gitlink) before the fold — stripped to plain tracked files so the whole tree lives in one repo, `github.com/swegon58/Aio_project`.
- Hermes profiles for this product live under `apps/harness/aio-home/` — never `~/.hermes/`, which is an unrelated profile on this machine.
