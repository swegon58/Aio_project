# Aio Project

Standalone product: "Aio" (All in One) — an AI agent app that should ship independently from internal tooling.

## Persona: Aio (Discord)
Handled globally via `~/.claude/CLAUDE.md` + `~/.claude/rules/aio-persona.md` (gated on `DISCORD_STATE_DIR`). No project-local override.

## Structure

```
Aio_project/
└── apps/
    ├── web/        ← Next.js frontend (landing + /app chat UI)
    └── harness/    ← Hermes-agent clone (backend brain), isolated via profile "aio" (apps/harness/aio-home/profiles/aio)
```

Use source files and the docs under `docs/` as the source of truth. Do not rely on old split/migration notes.

## Runtime boundary (mandatory)

Aio is the product layer. Hermes is the current runtime, not the product API.
Do not build new product features directly against raw Hermes concepts unless the code
is inside the runtime adapter layer.

Current boundary:

```
Aio Frontend
  -> Aio API / Route Handlers
  -> Aio Run Event Protocol
  -> Hermes Adapter / Event Mapper
  -> Hermes Runtime
```

Primary docs:

- `docs/architecture/aio_runtime_architecture.md`
- `docs/architecture/aio_run_event_protocol.md`
- `docs/roadmap/refactor_next_steps.md`

Web app runtime modules live under `apps/web/src/lib/aio/`:

- `chat/` request shaping, plan mode, stream compatibility, persistence
- `runs/` Aio-neutral run event protocol and writers
- `hermes/` Hermes client, SSE parsing, artifact proxying, event mapper
- `knowledge/` retrieval context and embeddings facade
- `billing/` credit guard and usage settlement facade
- `security/` input scanning and abuse guard facade

When changing chat/runtime behavior:

- Keep `apps/web/src/app/api/chat/route.ts` thin. It should coordinate request parsing, auth/runtime context, guards, runtime calls, streaming, settlement, and persistence.
- Prefer Aio-neutral types from `apps/web/src/lib/aio/runs/aio-run-events.ts`.
- Convert runtime-specific payloads through `apps/web/src/lib/aio/hermes/hermes-event-mapper.ts`.
- Keep legacy `data-hermes-*` stream parts working until the frontend is migrated to `data-aio-*`.
- Do not import Onyx/OpenManus or add another agent framework. Use them only as product/UX research references.
- Do not rename `hermes_conversations` or other Hermes-named persistence surfaces without an explicit migration plan.

## Secrets and local config

- `.mcp.json` and `apps/web/.mcp.json` are local-only files and must stay untracked.
- Use `.mcp.example.json` for placeholder MCP examples.
- Do not print or commit real tokens, keys, `.env` values, profile env files, or MCP credentials.

## Dev

- Frontend: `cd apps/web && npm install && npm run dev`
- Backend: `cd apps/harness/hermes-agent && uv venv && uv pip install -e .`, then launch
  with `HERMES_HOME`/`HOME` pointed at `apps/harness/aio-home/profiles/aio`

## Stable Notes

- Hermes profiles for this product live under `apps/harness/aio-home/` — never `~/.hermes/`, which is an unrelated profile on this machine.
- Chat runtime boundary lives under `apps/web/src/lib/aio/`; route-level code should not accumulate Hermes mapping, billing settlement, RAG retrieval, or persistence details.
