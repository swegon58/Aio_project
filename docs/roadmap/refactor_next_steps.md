# Refactor Next Steps

## Completed

- Security cleanup for MCP config tracking:
  - `.mcp.json` and `apps/web/.mcp.json` are untracked local files.
  - `.gitignore` blocks `.mcp.json`, `*.local.json`, `.env`, and `.env.*` while allowing env examples.
  - `.mcp.example.json` contains placeholder-only GitHub MCP config.
- Package metadata cleanup:
  - `apps/web/package.json` now uses Aio metadata instead of the old website-clone template metadata.
- Runtime boundary:
  - Aio product/runtime boundary lives under `apps/web/src/lib/aio`.
  - `apps/web/src/app/api/chat/route.ts` remains an orchestration layer.
- Event protocol:
  - `AioRunStatus` includes `waiting_approval`.
  - `AioRiskLevel` is normalized to `safe`, `medium`, `dangerous`.
  - Hermes events map through `HermesEventMapper` before reaching product/UI layers.
- Stream compatibility:
  - `data-aio-event` and `data-aio-*` stream parts are emitted.
  - Existing `data-hermes-*` stream parts remain intact as compatibility aliases.
  - The frontend prefers `data-aio-event` for Run Timeline state.
- Run Timeline UI:
  - Added `RunTimeline`, event cards, `AgentStateBadge`, `MascotStateMapper`, and a legacy frontend adapter.
  - Integrated `RunTimeline` into live workspace activity without deleting `ActivityStream`.
- Product module shells:
  - Added Tool Center, Knowledge Center, Agent Builder, Deep Research Mode, and Workflow Canvas surfaces in the right panel.

## Next Steps

1. Remove `data-hermes-*` aliases after compatibility verification.
2. Connect Tool Center to a real tool registry.
3. Connect Knowledge Center to document and memory management.
4. Persist Agent Builder definitions.
5. Back Deep Research Mode with source runs and citations.
6. Back Workflow Canvas with editable workflow state.
7. Add unit tests for `HermesEventMapper`, `frontend-event-adapter`, and `MascotStateMapper`.
8. Add a route integration test with mocked runtime SSE events.

## Security Reminder

If any real token was previously committed or shared, the owner must revoke it manually in the provider settings. Removing a file from tracking does not revoke exposed credentials.
