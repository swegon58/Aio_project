# Grill Log: Next Aio build — telemetry export + provider-adapter scope

**Date:** 2026-07-01
**Channel:** Discord (chat_id 1519020450322317362)
**Trigger:** User attached a "Deep Research" docx (generic/speculative, written without reading Aio's actual code) and asked to compare against `github.com/anomalyco/opencode`'s real architecture, then grill to decide what to build next.

## Pre-grill verification (before asking)

- Read `apps/web/src/lib/aio/tools/tool-policy.ts` — Aio's tool policy is plan-tier-gated + mandatory-approval-category based, more product-mature than opencode's generic wildcard policy.
- Read `apps/web/src/lib/aio/saved-agents/saved-agents.ts` — R7 Saved Agents deliberately minimal (name + instructions + knowledge toggle only), per `docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md`.
- Cloned opencode, read `packages/core/src/policy.ts` (49-line wildcard ACL), `packages/core/src/observability.ts` (real OTLP export layer).

## Post-pick verification (after user answered, in response to "did you actually check the code carefully")

- Read `apps/web/src/lib/aio/telemetry/telemetry.ts` in full — confirms Q1's premise exactly: `AioTelemetry`/`AioTracer`/`AioMetrics` is a **provider-neutral interface by design** (ADR-002: "Business logic imports from here, never from an OTel or Langfuse SDK directly... concrete implementation is injected at the edge"). Currently only two implementations exist: `NO_OP_TELEMETRY` (default) and `DEBUG_TELEMETRY` (console, gated by `OTEL_DEBUG=true`). No real exporter wired in yet — `resolveTelemetry()` has exactly one seam waiting for a third implementation (e.g. Langfuse-backed). This is a clean, already-prepared extension point, not a refactor.
- Read `apps/web/src/lib/aio/knowledge/embeddings.ts` (1-line re-export) → `apps/web/src/lib/hermes/knowledge.ts` in full — confirms Q4's premise: `embedTexts`/`embedOne` call OpenRouter's `/embeddings` endpoint via raw `fetch()`, entirely outside Hermes's LLM gateway, with no adapter abstraction around it today.
- Found one **doc/code drift**: ADR-003 says embeddings use `text-embedding-ada-002`; actual code (`hermes/knowledge.ts:12`) uses `openai/text-embedding-3-small`. Not blocking, just flagged — ADR text is stale vs. what shipped.
- Confirmed `docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md` exists (backs Q2's "deliberately frozen" claim).

Conclusion: the grill's technical premises for Q1, Q2, Q4 all check out against the real code, not just assumption. Q3 was separately confirmed via ADR-003 + `apps/web/src/lib/aio/research/research-stages.ts` (already implemented, tests passing) earlier in this session.

## Decisions

**Câu 1 — OTel/telemetry export target:** 🅱️ Hosted Langfuse.
Picked: `1b`. No elaboration given beyond the pick.

**Câu 2 — Saved Agents scope vs skill-authoring/marketplace:** 🅱️ Keep frozen as-is (R7 already made this call on purpose).
Picked: `2b`. No elaboration given.

**Câu 3 — Multi-runtime (DeerFlow) for Deep Research:** 🅱️ No — Hermes-only, Deep Research is Hermes-native.
Resolved via ADR-003 (Accepted, 2026-06-29, Product owner) before the user needed to pick — already an accepted architecture decision, and already implemented (`research-stages.ts`, tests passing).

**Câu 4 — Direct-provider adapter pattern (embeddings bypassing Hermes):** 🅱️ Formalize a small adapter pattern just for existing direct-provider call sites (embeddings), no wider scope.
Picked: `4b`. No elaboration given.

**Câu 5 — Sequencing vs. the 6 open owner-closeout items:** 🅰️ Pick one scoped engineering item now, in parallel — owner tasks don't block code work.
Picked: `5a`. No elaboration given.

## Round 2 — Langfuse implementation-level branches

User asked to keep grilling since round 1 was quick; also asked whether long grill sessions risk losing decision details across context compaction (answer: yes, it already happened once this session — mitigation is this log file, which survives compaction on disk).

**Câu 6 — Does the owner have a Langfuse account yet?** 🅱️ Sign up now, in parallel while the engineering side gets built; hand off keys as soon as they exist.
Picked: `6b`.

**Câu 7 — Initial span-export scope.** 🅱️ Export all existing internal spans from day one (run lifecycle + tool call + approval + research stage) — the span instrumentation already exists everywhere, this is just wiring an exporter, not new tracking code.
Picked: `7b`.

**Câu 8 — Where the Langfuse key lives.** 🅰️ App-level global env vars (`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`), one Langfuse project for the whole app — not per-Hermes-profile like `OPENROUTER_API_KEY`.
Picked: `8a`.

## Implementation (done, 2026-07-01)

Design refinement found via research (Langfuse's current v5+ SDK is OTel-native), which simplified the plan without contradicting any pick: instead of a Langfuse-specific `AioTelemetry` implementation, built against the vendor-neutral `@opentelemetry/api`, with Langfuse wired in exactly one place as the exporter. This keeps ADR-002's "never import a vendor SDK outside the edge" rule intact and means swapping exporters later only touches `instrumentation.ts`.

Shipped:
- `apps/web/src/lib/aio/telemetry/otel-telemetry.ts` — new `AioTracer`/`AioSpan` implementation against `@opentelemetry/api` (`trace.getTracer("aio")`), exported as `OTEL_TELEMETRY`. Metrics field is a local no-op (metrics export out of scope per Q7 — spans only).
- `apps/web/src/lib/aio/telemetry/telemetry.ts` — `resolveTelemetry()` now checks `LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY` first (→ `OTEL_TELEMETRY`), then `OTEL_DEBUG` (→ `DEBUG_TELEMETRY`), else `NO_OP_TELEMETRY`. `NO_OP_METRICS` exported for reuse.
- `apps/web/src/instrumentation.ts` — new Next.js server-startup hook (stable in Next 16). Gated on the same two env vars; when present, registers `NodeSDK` (`@opentelemetry/sdk-node`) with `LangfuseSpanProcessor` (`@langfuse/otel`) as the sole span processor. This is the only file in the repo that imports the Langfuse SDK.
- Wired the previously-dead `resolveTelemetry()` into both real call sites, which is what actually makes any of this take effect: `chat-transport.ts` and `schedule-runtime.ts` now pass `telemetry: resolveTelemetry()` into `orchestrateAioChatRun(...)` (previously both always fell through to the `NO_OP_TELEMETRY` default — confirmed dead code before this change).
- Deps added: `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@langfuse/otel`.
- `.env.local.example` documents `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` as optional (Q8a: app-level global, one project for the whole app).

No code-side blocker on missing keys — safe no-op today since the owner hasn't signed up yet (Q6b); owner supplies keys via env whenever Langfuse Cloud signup completes, and export starts automatically with zero further code changes.

Verified: `npm run typecheck` clean, `npm run lint` 0 errors (pre-existing warnings only), `npm run test:unit` 205/205 pass, `npm run build` succeeds.

Q4 (embeddings adapter, small formalization around `hermes/knowledge.ts`'s direct OpenRouter `fetch()` call) is next per Q5a (parallel-but-sequential engineering track — one scoped item at a time).

## Q4 implementation (done, 2026-07-01)

Formalized a small `EmbeddingProvider` seam (mirrors the `AioTelemetry` pattern) around the existing OpenRouter direct-`fetch()` embeddings call — scoped to exactly the two existing call sites per the grill pick (`4b`: no wider scope). `hermes/knowledge.ts` itself is untouched (still owns the raw `fetch()`).

Shipped:
- `apps/web/src/lib/aio/knowledge/embeddings.ts` — was a 1-line re-export of `embedOne`/`embedTexts`/`EMBEDDING_DIMENSIONS`; now exports `EmbeddingProvider` (interface: `dimensions`, `embedTexts(texts)`, `embedOne(text)`) and `createOpenRouterEmbeddingProvider(apiKey)`, a factory that closes over the API key.
- `apps/web/src/lib/aio/knowledge/ingest-pipeline.ts` — `indexKnowledgeChunks(db, userId, docId, chunks, embeddingProvider)` now takes an `EmbeddingProvider` instead of a raw `openrouterApiKey: string`; dimension validation uses `embeddingProvider.dimensions`.
- `apps/web/src/lib/aio/knowledge/retrieve-context.ts` — `buildKnowledgeContext(db, userId, embeddingProvider, lastMessage)` takes an `EmbeddingProvider` in place of the raw key.
- `apps/web/src/app/api/knowledge/docs/route.ts` (upload route, line ~122) and `apps/web/src/lib/aio/chat/run-orchestrator.ts` (RAG retrieval call, line ~262) both updated to construct `createOpenRouterEmbeddingProvider(apiKey)` at the call site and pass the provider in. `run-orchestrator.ts` still uses the raw `openrouterApiKey` separately for `fetchOpenRouterKeyUsage` (billing) — that dual-use was the reason the provider is constructed inline rather than replacing the key variable.

Scope note (flagged, not acted on): found a second, legacy knowledge/RAG system (`hermes_knowledge_files`/`hermes_knowledge_chunks`, `api/knowledge/route.ts`) that imports `embedTexts` directly from `hermes/knowledge.ts`, bypassing this seam entirely, and is not wired into chat-time retrieval. Left untouched per Q4's "no wider scope" — worth a future grill topic, not a Q4 bug.

Verified: `npm run typecheck` clean, `npm run lint` 0 errors (pre-existing warnings only), `npm run test:unit` 205/205 pass. No existing tests directly targeted the four changed signatures (confirmed via grep before editing), so no test files needed updates.

Both items from round 2 (Langfuse export, embeddings adapter) are now implemented. No further grill item is queued — next work needs either a new grill round or explicit direction.

## Round 3 — legacy knowledge system fate (2026-07-01, Discord)

User: "grill tiếp đi, xong luôn rồi mới làm" (keep grilling, finish deciding before doing more work).

**Câu 9 — `AioMetrics` no-op scope.** 🅰️ Leave `AioMetrics` as a no-op; telemetry stays spans-only (no metrics export).
Picked: `9a`.

**Câu 10 — Legacy knowledge system (`hermes_knowledge_files`/`hermes_knowledge_chunks`, flagged as a scope note in the Q4 writeup above) fate.** 🅱️ Plan a consolidation into the live `aio_knowledge_docs`/`aio_knowledge_chunks` system.
Picked: `10b`.

**Câu 11 — Sequencing.** 🅰️ Continue immediately with the next item (the consolidation itself) — same standing preference as `5a` (owner-closeout doesn't block code work).
Picked: `11a`.

### Sub-round — dead-code discovery

Investigated the legacy system before scoping the consolidation. Traced `AppHome.tsx`'s knowledge-upload state/handlers end-to-end (state → handler → prop → `SettingsModal.tsx` destructure → JSX search) and confirmed the entire legacy-upload UI path is **unreachable dead code**: the props were destructured in `SettingsModalProps` but the button that would have triggered them was never rendered — `SettingsModal.tsx`'s Knowledge tab only ever rendered `<KnowledgeCenterPanel />` (the live system). Reported this to the user and asked two follow-ups.

**Câu 12 — Delete the dead frontend code (`KnowledgeFile` interface, state, handlers, hidden `<input>`, dead props) from `AppHome.tsx`/`SettingsModal.tsx`?** 🅰️ Yes, delete — zero risk, confirmed unreachable.
Picked: `12a`.

**Câu 13 — What to do with the backend legacy system (`/api/knowledge/route.ts`, `hermes_knowledge_files`/`hermes_knowledge_chunks` tables, referenced by `account/export.ts`/`account/delete.ts`)?** 🅱️ Full consolidation — migrate any existing data into `aio_knowledge_docs`/`aio_knowledge_chunks`, drop the old tables + delete the legacy route, update export/delete to point at the new tables.
Picked: `13b`. Flagged to the user both when framing this question and again after the pick: any DROP TABLE / destructive migration against the real database needs a separate explicit confirmation before execution, even though the plan itself is authorized by this pick.

Same message, user also gave two standing process notes (saved to memory, not grill picks): (1) going forward, any UI-touching code change must be implemented **and tested live in a browser** before being reported done, not just typecheck/lint/build; (2) user noted no UI changes had shipped recently — confirmed true, since round 2's Langfuse export and Q4's embeddings adapter were both backend-only.

### Q12 implementation (done, 2026-07-01)

Removed all dead legacy-knowledge-upload wiring:
- `AppHome.tsx` — removed `KnowledgeFile` interface, `knowledgeFiles`/`knowledgeError`/`knowledgeUploading` state + `knowledgeFileInputRef`, the `loadKnowledgeFiles`/`handleKnowledgeFileSelected`/`handleKnowledgeDelete` handlers and their `useEffect`, the five dead props passed into `<SettingsModal>`, and the hidden `<input type="file">` element.
- `SettingsModal.tsx` — removed the `KnowledgeFile` interface, the five dead prop declarations in `SettingsModalProps`, and the five dead destructured parameters in the function signature.
- Left `ICON_RAIL_ITEMS`'s `"knowledge"` nav placeholder entry untouched — unrelated, pre-existing, intentionally-unwired nav item, out of scope for this cleanup.

Verified: `npm run typecheck` clean, `npm run lint` 0 errors (pre-existing warnings only), `npm run test:unit` 205/205 pass. Dev server (already running on :3000) live-recompiled through the edit: caught a real transient `ReferenceError: knowledgeFiles is not defined` in the window between the `AppHome.tsx` edit and the `SettingsModal.tsx` edit, then compiled clean with zero errors after the final edit — direct evidence the change is runtime-correct, not just type-correct.

**Browser testing caveat:** the Claude-in-Chrome extension was not connected in this session, so a full interactive click-through (open Settings → Knowledge tab → confirm `KnowledgeCenterPanel` renders, no console errors) could not be performed, despite the new standing rule requiring it. This is disclosed explicitly rather than implied as done. Recommend the user (or a future session with the extension connected) does a quick manual check of Settings → Knowledge tab.

### Q13 implementation (app code done, migration drafted-not-run, 2026-07-01)

Checked real Supabase data first (service-role query): `hermes_knowledge_files` and `hermes_knowledge_chunks` are both **0 rows** — no data migration step needed. Also found `account/export.ts`/`account/delete.ts` already independently covered `aio_knowledge_docs`/`aio_knowledge_chunks` (the live tables) alongside the legacy ones, so GDPR completeness was never actually at risk from removing the legacy references.

Shipped (app code, non-destructive):
- `src/lib/account/export.ts` — removed the two legacy `TABLES` entries (`hermes_knowledge_files`, `hermes_knowledge_chunks`); live `aio_knowledge_docs`/`aio_knowledge_chunks` entries were already present, untouched.
- `src/lib/account/delete.ts` — removed the `hermes_knowledge_files` storage-path collection call; `aio_knowledge_docs` collection was already present, untouched.
- `src/lib/account/export.test.ts`, `src/lib/account/delete.test.ts` — updated fixtures to drop legacy-table references, kept coverage on the live tables.
- Deleted `src/app/api/knowledge/route.ts` (the dead legacy route; confirmed no remaining caller via grep). Live routes `api/knowledge/docs/route.ts` and `api/knowledge/docs/[docId]/route.ts` untouched.
- Drafted (not executed) `supabase/migrations/0024_drop_legacy_knowledge.sql` — drops `match_knowledge_chunks()`, `hermes_knowledge_chunks`, `hermes_knowledge_files`. Documents in-file that both tables are confirmed empty as of 2026-07-01.

Verified: `npm run typecheck` clean (after clearing a stale `.next/types` cache entry pointing at the deleted route), `npm run lint` 0 errors, `npm run test:unit` 205/205 pass.

**Not done, needs separate explicit confirmation:** migration 0024 has not been applied to the real database. Per the destructive-operations rule (flagged twice before the 13b pick, reaffirmed here), running this migration requires the user's explicit go-ahead in a future turn — the file being written is not that confirmation.

## Round 4 — product-readiness build queue (2026-07-01, Discord)

Triggered by a background deep-research fork auditing Aio's real UI/feature/backend state against a product-ready bar (~55% ready for external beta, ~80% ready for self-use, per the fork's evidence-grounded findings — file:line citations, not the earlier generic docx).

**Câu 14 — Which readiness bar to target first?** 🅰️ External beta first — front-load the expensive items (secret isolation, route tests) now rather than deferring them.
Picked: `14a`. (Recommended pick was `14b`, self-use-first/defer-expensive — user overrode the recommendation.)

**Câu 15 — Scheduled Tasks panel UI** (backend/state code already 100% complete, `cronJobs`/`handleCronCreate`/`handleCronDelete`/`loadCronJobs` in `AppHome.tsx`, wired to real `/api/cron` routes, never rendered in JSX). 🅰️ Build the panel now.
Picked: `15a`.

**Câu 16 — Next.js `error.tsx`/`not-found.tsx`.** 🅰️ Add now.
Picked: `16a`.

**Câu 17 — Route-level tests for high-risk handlers** (billing/checkout, Paddle webhook, account export/delete, cron). 🅰️ Write these now, before more feature work.
Picked: `17a`.

**Câu 18 — 3 dead nav-rail icons** (agents/tasks/analytics — currently inert). 🅱️ Keep visible but disable clearly (dimmed + "coming soon" tooltip) instead of hiding or leaving silently broken.
Picked: `18b`.

**Câu 19 — Per-customer secret isolation (Vault, Q41 from the fork report)** — all customers currently share Aio's dev provider key. 🅰️ Research/scope this now rather than deferring to just-before-beta.
Picked: `19a`.

All six picks confirm `14a`'s framing: build the external-beta-readiness path now, in priority order (quick wins first, expensive/blocking item last since it needs research before it can even be scoped into concrete tasks): `16a` (error pages) → `15a` (Scheduled Tasks panel) → `18b` (nav rail disabled states) → `17a` (route tests: billing, Paddle webhook, account export/delete, cron) → `19a` (Vault/secret-isolation research+scope).

### Handoff instruction (not a grill pick — a process note)

User: *"nhưng tôi sẽ qua session mới và build, hãy chuẩn bị và khi tôi qua session mới và nói 'build Aio tiếp' là biết nhé"* — will start a new session to do the actual build; asked me to prepare so that a fresh session recognizes "build Aio tiếp" (same trigger phrase as CLAUDE.md's "continue building Aio") and picks up this exact queue with no further clarification needed.

Prepared for handoff: created `docs/roadmap/R8_EXECUTION_CHECKLIST.md` (new phase, R8 — Beta-Readiness Hardening) with all five tasks in the order above, and updated `AIO_PROJECT_STATE.md`'s "Next Decision Gate" to point at R8 as the approved next phase (no further approval needed — this grill round *is* the approval). Migration `0024` stays a separate, still-unconfirmed item, not folded into R8.
