# Aio — Project Context

"Aio" (All in One) — AI agent product/brand, separate from sweqcore. Inspired by manus.im, scoped via grill session 2026-06-11/12.

## Status
- Landing done. Current focus: `/app` — chat UI, Settings modal (Credentials/Connections), Activity tab (Kanban/Gallery), chat history, mascot, streaming bubble fixes.
- Backend brain: `../harness/` (Hermes-agent clone, profile "aio") — see `apps/harness/CLAUDE.md`. Phase 1 = wrap as-is via API, no core edits. Wired live (chat streaming, Honcho memory, Daytona sandbox).
- `src/lib/brand.config.ts` — Manus→Aio rebrand config (name, tagline, accent #0081f2). Default palette: Manus neutral black/white/gray, accent is user-customizable.
- Backend model provider: **LM Studio, permanent** (`qwen/qwen3.5-9b` local). Provider resolution reads `auth.json`'s `credential_pool`, not just `config.yaml`'s `model.base_url` — both must be set or it silently falls back to OpenRouter with a dead key (401 swallowed, looks like "not responding").

## Remaining work
1. Plan-mode UI polish loop: screenshot `/app` plan-choice/grill-me card, review vs "đẹp và chuẩn" bar, fix. Known issues: fragile `aio-question` fenced-block regex, no question-count cap (infinite-loop risk).
2. Finish nav links + remaining brand swaps via `brand.config.ts`.
3. Paddle not live — set `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`/`PADDLE_PRICE_ID_*` before real deploy (falls back to `DevNoopPaymentProvider` until then).

## Constraints
- Browser automation: Playwright MCP not installed currently (toggled off). Chrome MCP (`claude --chrome`) is the fallback. Check `.mcp.json` before assuming either is available.
- Screenshots are expensive — review one card/flow at a time per loop iteration.

## Scope lock (don't re-litigate without user)
- Target customer: global prosumer/SMB + VN B2B agency-as-a-service.
- MVP wedge: browser/data automation agent + ops reporting agent.
- Pricing: subscription tiers + per-project/one-off early on.
- Build order: landing/brand page first, app/dashboard after first paying client(s).

---

@AGENTS.md
