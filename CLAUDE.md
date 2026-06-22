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
- 2026-06-22: Model provider switched OpenRouter → **LM Studio, permanent** (user directive, `qwen/qwen3.5-9b` local). Provider resolution is governed by `aio-home/profiles/aio/auth.json`'s `credential_pool`, NOT just `config.yaml`'s `model.base_url` — editing base_url alone is insufficient and silently keeps routing to whichever provider has a registered credential. Required: `hermes auth add lmstudio --type api-key --api-key "lm-studio"` (LM Studio doesn't need a real key) + `provider: lmstudio` added under `model:` in `config.yaml`. Without both, Hermes kept calling OpenRouter with the dead key, got 401, and Aio's `/api/chat` silently returned 200 with empty content (looked like "Aio not responding" with no visible error). Restart gateway after either change.
- 2026-06-18: Honcho memory enabled for profile "aio" — `honcho-ai` installed in `hermes-agent/.venv`, `memory.provider: honcho` set in `aio-home/profiles/aio/config.yaml`, `HONCHO_API_KEY` in profile `.env`, gateway restarted, `doctor` confirms "Honcho configured".
- UI feature work (Connections tab, Activity tab w/ Kanban+Memory, image gallery, credential manager, usage/guardrail/compression badge) in progress on branch `ui-mockup-port`. **Merge to master gated on explicit user approval — do not merge unprompted.**
- 2026-06-22: found `terminal`/`process` tools are NOT in `ALL_GATEABLE_TOOLSETS` (`Aio/src/lib/hermes/pricing.ts`) — always available on every tier per-design comment ("base infra"). This lets any tier (incl. Starter) shell out via `curl`/`python` to external paid APIs (kie.ai, ElevenLabs, etc.) using the customer's own key, fully bypassing `image_gen`/`video_gen`/`tts`/`code_execution` tier gating. Sandboxed (Daytona/Modal, not host), but outbound network is open — gating is currently soft upsell, not a hard boundary. Fix in progress: outbound network allowlist per sandbox, all tiers.

## Integration decisions (locked via grill 2026-06-13, multi-tenant model superseded 2026-06-15 BUILD_SPEC grill)
- **Multi-tenant**: profile-per-customer (`cust_<id>`, see `Aio/src/lib/hermes/provision.ts`), not the single-shared-profile + `X-Hermes-Session-Key` model originally locked 2026-06-13. Dev profile "aio" itself remains the shared sandbox/test profile, separate from per-customer prod profiles.
- **API**: Aio (Next.js) → Hermes `/v1/chat/completions` (streaming SSE) via Vercel AI SDK (OpenAI-compatible adapter) + `X-Hermes-Session-Key`.
- **Model provider**: OpenRouter (1 key, 300+ models, per-tier model swap + fallback).
- **Deploy**: Phase 1 = Hermes local (profile "aio", port 8642), Aio dev calls in. Real deploy (VPS/Railway/Docker) only after first paying customer.
- **Profile skills**: created with bundled defaults (full agentskills.io set), NOT `--empty`.

## Strategy (locked via grill 2026-06-13)
Phase 1: wrap Hermes as-is (profile "aio") with Aio UI on top, ship fast.
Phase 2 (later, based on real usage): selectively port portable pieces (prompts, skill defs, tool schemas, memory format) into Aio's own stack if/when needed. Not a rewrite mandate.
