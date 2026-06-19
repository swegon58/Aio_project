# Aio_harness

Clone of [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (MIT) — backend agent harness for **Aio**.

## What this is
- `hermes-agent/` — upstream source, cloned 2026-06-13. Reference + place Aio calls into via API/MCP.
- Runs as Hermes **profile "aio"** (`Aio_harness/aio-home/profiles/aio`, launched with `HERMES_HOME=aio-home -p aio`) — fully isolated instance: own config, API keys, memory, sessions, skills.

## Hard rules
- **Do not touch `~/.hermes/` (default profile = Himeko)**. Profile "aio" lives under `aio-home/`, no shared state.
- **Do not modify `hermes-agent/` source** unless explicitly needed (Phase 1 = wrap with UI, no core edits).
- Aio (`../Aio`, Next.js) is the UI/product. This harness is the brain it calls into — keep them decoupled (API/MCP boundary, not direct imports).

## Status
- 2026-06-18: Honcho memory enabled for profile "aio" — `honcho-ai` installed in `hermes-agent/.venv`, `memory.provider: honcho` set in `aio-home/profiles/aio/config.yaml`, `HONCHO_API_KEY` in profile `.env`, gateway restarted, `doctor` confirms "Honcho configured".
- UI feature work (Connections tab, Activity tab w/ Kanban+Memory, image gallery, credential manager, usage/guardrail/compression badge) in progress on branch `ui-mockup-port`. **Merge to master gated on explicit user approval — do not merge unprompted.**

## Integration decisions (locked via grill 2026-06-13)
- **Multi-tenant**: single profile "aio", per-customer isolation via `X-Hermes-Session-Key` header (Honcho scopes memory per key). Not profile-per-customer.
- **API**: Aio (Next.js) → Hermes `/v1/chat/completions` (streaming SSE) via Vercel AI SDK (OpenAI-compatible adapter) + `X-Hermes-Session-Key`.
- **Model provider**: OpenRouter (1 key, 300+ models, per-tier model swap + fallback).
- **Deploy**: Phase 1 = Hermes local (profile "aio", port 8642), Aio dev calls in. Real deploy (VPS/Railway/Docker) only after first paying customer.
- **Profile skills**: created with bundled defaults (full agentskills.io set), NOT `--empty`.

## Strategy (locked via grill 2026-06-13)
Phase 1: wrap Hermes as-is (profile "aio") with Aio UI on top, ship fast.
Phase 2 (later, based on real usage): selectively port portable pieces (prompts, skill defs, tool schemas, memory format) into Aio's own stack if/when needed. Not a rewrite mandate.
