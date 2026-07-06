# R12 Execution Checklist — AppHome Decomposition + open-webui RAG/Valves

**Status:** retrospective — all R12 code committed on `feat/r12-fixes` and
ff-merged into local `main` (2026-07-07). Two tracks shipped independently:
- **R12.1 AppHome decomposition** — split the 4000-line `AppHome.tsx` into hooks,
  contexts, and section components (Karpathy "surgical" + maintainability).
- **R12.2 open-webui RAG/Valves** — steal-list from open-webui (144k★):
  hybrid BM25+vector search, per-tool valves, `[N]` research citations,
  prompt-variable interpolation.

## Status Key

- `[x]` committed + verified
- `[~]` committed, owner-gate open (remote DB apply / wiring decision)
- `[ ]` deferred / blocked

## R12.1 — AppHome decomposition [x]

- [x] **11 hooks extracted** (`useCronJobs`, `useNotifications`,
      `useConnections`, `useCredentials`, `useAccountPrefs`,
      `useWorkspacePanel`, `useImageGeneration`, `usePlanFlow`,
      `useConversations`, `useRunTimeline`, `useChatComposer`) — each owns one
      concern, lifted state out of the god-component.
- [x] **3 context providers** added (`Step 2`) so sections read shared state
      without prop-drilling.
- [x] **6 section components** extracted in `Step 3.1–3.6` (`AppModals`,
      `LeftSidebar`, `FloatingChrome`, `RightPanel`, `Composer`, `MessageList`).
- [x] Pure helpers (code-block, report-export) lifted to `app-home-utils.ts`.
- [x] **Result:** `AppHome.tsx` 4000 → ~1300 lines. `npx tsc --noEmit` clean,
      264/264 unit tests pass, Playwright desktop green.
      Commits: `84d0e28` … `5e10f45`; documented in `441520d`.

## R12.2 — open-webui RAG/Valves [~]

- [x] **Hybrid BM25+vector search** — migration `0031_knowledge_hybrid_search.sql`
      (RRF fusion of `tsvector` + `pgvector`), wired into
      `lib/aio/knowledge/retrieve-context.ts`. **`[~]` remote apply owner-gated**
      (shared Supabase — see gate 1).
- [x] **Per-tool valves** — migration `0032_aio_tool_valves.sql`,
      `lib/aio/knowledge/valves.ts`, `/api/account/valves/`, Settings → Knowledge
      tab. **`[~]` remote apply owner-gated.**
- [x] **`[N]` research citations** — `lib/aio/chat/research-mode.ts` +
      `run-orchestrator.ts` emit numbered source refs in research-mode replies.
- [x] **Prompt-variable interpolation** — `lib/aio/chat/prompt-variables.ts`
      (+ unit test `prompt-variables.test.ts`).
- [x] **Internal knowledge endpoints** — `/api/internal/knowledge/` (read paths).
      **`[~]` Hermes-tool wiring is a separate owner decision (gate 2).**
      Commit: `f4ce9f4`.

## R12.3 — UI polish [x]

- [x] Sidebar icon-rail + composer input-area CSS (`02-sidebar-icon-rail.css`,
      `04-input-area.css`).
- [x] Mobile LAN config fix (`next.config.ts` allowed origins,
      `scripts/run-aio-app.sh`).
      Commit: `d464723`. Vietnamese explainers R8–R12 + `OWNER_PENDING_OPENWEBUI.md`
      in `c2408a4`.

## Deferred / blocked [ ]

- [ ] **T1.3 knowledge-as-tool** — surface the internal knowledge endpoints as
      Hermes tools so the agent actively retrieves instead of relying on the
      passive RAG-injection path. Blocked: needs the gate-2 wiring decision +
      rate-limit headroom.
- [ ] **Tier-3 UX** — richer citations/sources panel (open-webui-style source
      cards). Blocked: rate-limited this session; deferred to a follow-up.

## Open decision gates (owner)

1. **Apply migrations `0031`/`0032` to remote Supabase** — shared DB; unblocks
   live hybrid search + valves. (R10 `0026`/`0027` are in the same gate.)
2. **Internal knowledge endpoints → Hermes tools** — gate for T1.3.
3. **Push local `main` → `origin/main`** — deploy/CI timing is owner-controlled.

## Evidence Log

- 2026-07-03 → 2026-07-05: AppHome.tsx decomposed incrementally
  (`84d0e28`→`5e10f45`); image-reply variants + composer/modal CSS polish
  (`52753ce`). Playwright 6/6, unit 264/264.
- 2026-07-05: open-webui gap inventory run (3-tier steal-list: RAG citation,
  BM25+vector hybrid, knowledge-as-toolset); owner approved full impl.
- 2026-07-07: open-webui Tier-1 (hybrid search, valves, citations,
  prompt-variables) committed as `f4ce9f4`; UI polish `d464723`; explainers
  `c2408a4`. Migrations committed to git **only** — remote DB apply remains
  owner-gated (no `supabase db push` ran). T1.3 + Tier-3 deferred.
