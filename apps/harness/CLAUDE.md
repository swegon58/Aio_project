# apps/harness

Clone of [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (MIT) — backend agent harness for **Aio**.

## What this is
- `hermes-agent/` — upstream source, cloned 2026-06-13. Reference + place Aio calls into via API/MCP.
- Runs as Hermes **profile "aio"** (`aio-home/profiles/aio`, launched with `HERMES_HOME=aio-home -p aio`) — fully isolated: own config, API keys, memory, sessions, skills.

## Hard rules
- **Do not touch `~/.hermes/`** (default profile = Himeko). Profile "aio" stays under `aio-home/`, no shared state.
- **Do not modify `hermes-agent/` source** unless explicitly needed (Phase 1 = wrap with UI, no core edits).
- `../web` (Next.js) is the UI/product, decoupled via API/MCP boundary — no direct imports either direction.

## Status
- Model provider: **LM Studio, permanent** (`qwen/qwen3.5-9b` local). Set via `hermes auth add lmstudio --type api-key --api-key "lm-studio"` + `provider: lmstudio` under `model:` in `config.yaml` — both required, base_url alone is insufficient.
- Honcho memory enabled for profile "aio" (`memory.provider: honcho`, `HONCHO_API_KEY` in profile `.env`).
- UI feature work (Connections/Activity tabs, gallery, credential manager, usage badge) in progress on branch `ui-mockup-port`. **Merge to master gated on explicit user approval.**
- Known gap: `terminal`/`process` tools are NOT in `ALL_GATEABLE_TOOLSETS` (`apps/web/src/lib/hermes/pricing.ts`) — always available, every tier, by design ("base infra"). Lets any tier shell out to paid external APIs with the customer's own key, bypassing `image_gen`/`video_gen`/`tts`/`code_execution` gating. Sandboxed, but outbound network is open — soft upsell, not a hard boundary. Fix in progress: outbound network allowlist per sandbox.

## Integration decisions (locked via grill 2026-06-13, superseded 2026-06-15 BUILD_SPEC grill)
- **Multi-tenant**: profile-per-customer (`cust_<id>`, see `apps/web/src/lib/hermes/provision.ts`). Dev profile "aio" stays the shared sandbox/test profile, separate from per-customer prod profiles.
- **API**: Aio (Next.js) → Hermes `/v1/chat/completions` (streaming SSE) via Vercel AI SDK + `X-Hermes-Session-Key`.
- **Model provider**: OpenRouter (1 key, 300+ models, per-tier swap + fallback).
- **Deploy**: Phase 1 = Hermes local (profile "aio", port 8642). Real deploy (VPS/Railway/Docker) only after first paying customer.
- **Profile skills**: bundled defaults (full agentskills.io set), NOT `--empty`.

## Strategy (locked via grill 2026-06-13)
Phase 1: wrap Hermes as-is with Aio UI on top, ship fast. Phase 2 (later, usage-driven): selectively port portable pieces (prompts, skill defs, tool schemas, memory format) into Aio's own stack if needed — not a rewrite mandate.
