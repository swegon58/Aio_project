# Aio — Project Context

"Aio" (All in One) — AI agent product/brand, separate from sweqcore. Inspired by manus.im, scoped via grill session 2026-06-11/12.

## Status
- Landing done, brand swap done (no `Manus` leftovers in code). `/app` chat UI: right-panel redesign done (icon-rail sidebar w/ hover-expand, terminal restyle, agent-bubble blur — commit `2d5c003`, 2026-06-24).
- Plan-mode `aio-question` flow: server-enforced question cap (`MIN_PLAN_QUESTIONS=2`, `MAX_PLAN_QUESTIONS=5` in `src/app/api/chat/route.ts`) and robust fence-parsing (`parsePlanQuestion` in `AppHome.tsx`, handles missing/wrong tag + malformed JSON). Verified 2026-06-24 — not fragile, not infinite-loop-prone.
- Backend brain: `../harness/` (Hermes-agent clone, profile "aio") — see `apps/harness/CLAUDE.md`. Phase 1 = wrap as-is via API, no core edits. Wired live (chat streaming, Honcho memory, Daytona sandbox).
- `src/lib/brand.config.ts` — Manus→Aio rebrand config (name, tagline, accent #0081f2). Default palette: Manus neutral black/white/gray, accent is user-customizable.
- Backend model provider: **LM Studio, permanent** (`qwen/qwen3.5-9b` local). Provider resolution reads `auth.json`'s `credential_pool`, not just `config.yaml`'s `model.base_url` — both must be set or it silently falls back to OpenRouter with a dead key (401 swallowed, looks like "not responding").

## Remaining work
1. Paddle not live — no env keys set (`PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`/`PADDLE_PRICE_ID_*` all absent), still on `DevNoopPaymentProvider`. Set before real deploy.
2. Vault wiring (Q41, deferred on purpose) — per-customer secrets still use shared `OPENROUTER_API_KEY`/`DAYTONA_API_KEY` from gitignored profile `.env`. TODOs at `apps/harness/.../provision.ts:177,196,205,293` (path under harness, check exact file).
3. Preview-sandbox only supports Node runtimes — Python/other runtime detection is an explicit v2 TODO in `src/lib/hermes/preview-sandbox.ts:31,125`.

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
