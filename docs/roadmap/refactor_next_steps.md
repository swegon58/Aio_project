# Refactor Next Steps

## Completed In This Pass

- Removed tracked MCP config files from Git tracking while keeping local copies on disk.
- Added `.mcp.json` and local secret-style files to `.gitignore`.
- Added `.mcp.example.json` with placeholder-only GitHub MCP config.
- Introduced the Aio runtime boundary under `apps/web/src/lib/aio`.
- Added `AioRunEvent` and a Hermes-to-Aio event mapper.
- Kept existing `data-hermes-*` stream output for frontend compatibility.
- Extracted plan-mode prompts, request shaping, conversation persistence, RAG retrieval, credit guard, usage settlement, runtime client calls, SSE parsing, and input scanning.

## Near-Term Work

- Migrate frontend stream readers from `data-hermes-*` to `data-aio-*`.
- Rename database tables such as `hermes_conversations` only after a migration plan exists.
- Add unit tests for `HermesEventMapper`, especially tool reconciliation, artifact creation, approvals, and code execution showcase updates.
- Move credit pricing imports behind an Aio billing naming layer so the route no longer imports from `lib/hermes/pricing`.
- Add an integration test for the chat route with mocked runtime responses.

## Product Feature Tracks

- Run Timeline: render `AioRunEvent` as an inspectable task history.
- Tool Center: expose tool availability and approval controls without runtime-specific naming.
- Knowledge Center: make document retrieval visible and manageable.
- Agent Builder: define user-facing workflows on top of Aio events, not runtime internals.
- Deep Research: use the event protocol for long-running research status, sources, artifacts, and checkpoints.
- Workflow Canvas: model multi-step user workflows as Aio tasks and artifacts.

## Research Rule

Onyx and OpenManus can inform UX and workflow choices, but Aio should not import their agent frameworks or reshape itself around developer-operations use cases.
