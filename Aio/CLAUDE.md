# Aio — Project Context

"Aio" (All in One) — AI agent product/brand, separate from sweqcore. Inspired by manus.im, scoped via grill session 2026-06-11/12.

## Status
- Landing (Header/Banner/Hero) done. Current focus: `/app` build — chat UI, Settings modal (Credentials/Connections tabs), Activity tab (Kanban/Gallery), chat history persistence, mascot, auto-scroll + streaming bubble fixes.
- Backend brain: `../Aio_harness/` (Hermes-agent clone, profile "aio") — see `Aio_harness/CLAUDE.md`. Phase 1 = wrap as-is via API, no core edits. Hermes wired live (chat streaming, Honcho memory, Daytona sandbox).
- `src/lib/brand.config.ts` — Manus→Aio rebrand config (name, tagline, accent color #0081f2)
- Default palette: keep Manus neutral black/white/gray; accent color is user-customizable (core personalization feature)
- App icon/favicon: `public/seo/icon.png`, `apple-icon.png`, `favicon.ico`, `src/app/favicon.ico` — Aio robot-mascot logo (2026-06-18)
- Branch `experiment/liquid-glass` merged → `master` 2026-06-18
- Backend model provider: **LM Studio, permanent** (user directive 2026-06-22, not a temp test) — `qwen/qwen3.5-9b` local. Fixed 2026-06-22: Hermes was still silently routing to OpenRouter (dead key, 401 swallowed as empty response) because provider resolution reads `auth.json`'s `credential_pool`, not just `config.yaml`'s `model.base_url`. Fix = `hermes auth add lmstudio` (credential) + `provider: lmstudio` added under `model:` in `Aio_harness/aio-home/profiles/aio/config.yaml`. Verified end-to-end in `/app` UI.

## Remaining work
1. Plan-mode UI polish loop (active 2026-06-22): March 7th (haiku) screenshots `/app` plan-choice/grill-me card via Playwright MCP, reviews vs "đẹp và chuẩn" bar, hands findings to Dan Heng to fix. Repeats until user says stop. Known findings carried in: fragile `aio-question` fenced-block regex parsing, unenforced question-count cap (infinite-loop risk).
2. Finish nav links + remaining brand swaps via `brand.config.ts`
3. Paddle account not live yet — set `PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`/`PADDLE_PRICE_ID_*` env vars before real deploy (checkout/webhook routes + Paddle provider done 2026-06-22, falls back to `DevNoopPaymentProvider` until env vars set)

## Constraints
- Browser automation: Playwright MCP removed again 2026-06-22 (user toggled off after verification use) — not installed currently. Chrome MCP (`claude --chrome`) remains the option for dedicated terminal sessions in `Aio/`. Check `.mcp.json` before assuming either is available.
- Screenshots are expensive — review one card/flow at a time per loop iteration

## Scope lock (don't re-litigate without user)
- Target customer: global prosumer/SMB + VN B2B agency-as-a-service
- MVP wedge: browser/data automation agent + ops reporting agent
- Pricing: subscription tiers + per-project/one-off early on
- Build order: landing/brand page first, app/dashboard after first paying client(s)

---

@AGENTS.md
