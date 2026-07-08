# R13 Execution Checklist — Invite-Alpha Hardening

**Status:** in progress (2026-07-08) — 3 of 6 P0 items closed same day
(knowledge-route schema fix, approval-audit wiring, Gate A resolved), run
watchdog code done pending owner-applied migration, Gate B still open. Same
day, owner also flagged Deep Research UX as sub-standard vs. ChatGPT/Gemini
(3 screenshots) — audited, 4 gaps confirmed, plan added as R13.3 below; not
started, next session picks this up.
Source: 2026-07-08 6-agent audit (kimo,
product-ux-guardian, frontend-builder, backend-builder, qa-reviewer,
hermes-architect) against the "ready for invite-only alpha" bar — composite
6.1/10. Full findings:
[artifact](https://claude.ai/code/artifact/a0beb1d8-138c-41b6-9cb1-34615017c336).
Separate lane from `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md` (that plan is
compliance/legal/i18n hardening; this one is UI polish + code quality/reliability).

## Status Key

- `[x]` done + verified
- `[~]` in progress / partially done
- `[ ]` not started
- `[G]` blocked on an owner decision gate (see bottom)

## R13.0 — P0: must close before inviting anyone beyond current users

- [x] **Fix internal knowledge routes' schema mismatch.** Done 2026-07-08
      (`tsc --noEmit` clean); curl smoke test still pending real test data.
      Both
      `apps/web/src/app/api/internal/knowledge/grep/route.ts` and
      `.../knowledge/query/route.ts` still target the dropped
      `hermes_knowledge_chunks` table / a nonexistent `file_id` field — confirmed
      by two independent agent passes. Verified against current schema
      (`0015_aio_knowledge.sql`, `0031_knowledge_hybrid_search.sql`):
      - `grep/route.ts`: table `hermes_knowledge_chunks` → `aio_knowledge_chunks`;
        `.eq("customer_id", ...)` → `.eq("user_id", ...)`; select/order/response
        `file_id` → `doc_id` (keep `chunk_index` in the order-by, it's a real
        column).
      - `query/route.ts`: RPC call itself is already correct
        (`match_knowledge_chunks_hybrid` / `p_customer_id`); only the response
        mapping is wrong — `r.file_id` → `r.doc_id` (RPC returns
        `id, doc_id, content, similarity`, no `file_id`).
      Currently dead code (not wired to a Hermes tool yet — gate 1 below), so
      no live-traffic risk, but must be correct before wiring. Effort: S.
      Verify: `npx tsc --noEmit`, then a curl smoke test against both routes
      with the internal secret header once a knowledge doc exists for a test
      user.

- [x] **Wire the real approval path to the durable audit trail.** Done
      2026-07-08: `apps/web/src/app/api/chat/approval/route.ts` now calls
      `resolveApproval()` (best-effort, after Hermes accepts the choice) with
      `resolvedBy: userId`, `resolution: reject` for `choice === "deny"` else
      `approve`. `tsc --noEmit` clean. Still need a live-UI verify: approve a
      real run's tool call, confirm the `aio_approvals` row status matches
      the click, not `expired`.

- [~] **Build a lease/heartbeat/sweep mechanism for `aio_runs`.** Code done
      2026-07-08, migration not yet applied (owner-gated). Mirrors the
      `aio_jobs` pattern:
      - Migration `apps/web/supabase/migrations/0033_aio_runs_lease.sql` —
        adds `lease_owner`/`lease_token`/`lease_expires_at`/`last_heartbeat_at`
        to `aio_runs` + `aio_sweep_expired_run_leases()`. Unlike jobs, a run
        is never requeued: sweep closes `running` → `failed`,
        `cancelling` → `cancelled` (the only legal edges), never deletes.
      - `run-repository.ts`: `startRunLease`, `heartbeatRunLease`,
        `sweepExpiredRunLeases`; `transitionRun` now clears lease fields on
        every terminal write.
      - Sweep entrypoint: reused the existing job-worker loop
        (`aio-job-worker-runtime.ts` `sweepQueues()`, driven by
        `scripts/aio-job-worker.ts`) — no new cron.
      - Orchestrator wiring (`run-orchestrator.ts`): `startRunLease` right
        after `queued → running`, a `setInterval` heartbeat alongside the SSE
        read loop, cleared in the same `finally` as `teardown()`.
      - **Stop-button race fixed** (was `run-orchestrator.ts` ~L576-759): the
        closing `finally` block only ever wrote `completed`/`failed`; if
        `/api/runs/[runId]/stop` had already moved the row to `cancelling`
        (running → cancelling is legal) concurrently, that write was rejected
        by the state machine (cancelling only allows → cancelled) and nothing
        ever retried — the row was stuck in `cancelling` forever. Fixed by
        `resolveRunClosureAction()`: re-read the live status right before the
        terminal write and prefer `cancelled` whenever it's already
        `cancelling`.
      - `npx tsc --noEmit` clean; unit tests added/passing
        (`resolveRunClosureAction` in `run-orchestrator-dedupe.test.ts`,
        sweep-call test in `aio-job-worker-runtime.test.ts`).
      - Still open: owner applies `0033_aio_runs_lease.sql`, then live-verify
        per the original plan (kill dev server mid-run, confirm sweep flips
        the row within one lease window ~90s; re-test Stop under a
        slow/streaming response). Did not touch stuck row
        `66a29fab-ce6f-40e1-8914-c2fc73528361` — still owner-gated.

- [x] **Gate A resolved — per-customer provisioning already built/live**
      (`provision.ts` + `hermes_registry`); shared "aio" profile leak was
      local-dev-bypass only, blocked in prod. Full detail:
      `reference_hermes_native_features_for_ui` memory. Real remaining gaps:
      - [ ] Set `OPENROUTER_PROVISIONING_KEY` (empty today → shared-key
            fallback, no per-customer spend cap). Owner action. Effort: XS,
            blocking before real invites.
      - [ ] Verify `NEXT_PUBLIC_DEV_AUTH_BYPASS=false` in every non-local env.
            Effort: XS.
      - [ ] Decide Honcho memory-provider status (declared but not
            per-profile-configured — "Q41 TODO" in code). Effort: S.
      - [ ] Per-customer `DAYTONA_API_KEY` (currently shared, "Q41 TODO").
            Mirror existing OpenRouter-key Vault pattern. Effort: M.
      - [ ] Decouple prod catalog seed from the live dev "aio" profile
            ("Q12b master catalog" placeholder in `provision.ts:69-74`).
            Effort: M.

- `[G]` **Hide or redesign Connected Apps / Model Providers.**
      `apps/web/src/components/app/SettingsModal.tsx:409-545` is an ops
      console (raw env var names, "restart the gateway" success message with
      no way for an external user to restart anything) — a guaranteed
      dead-end for anyone outside the owner. **Blocked on Gate B** — hide the
      tab for non-owner accounts (cheap, S) vs. invest in a real OAuth-style
      flow like the existing Google Calendar connection (M–L). Owner picks the
      target before implementation starts.

- [ ] **Resolve the stuck run `66a29fab-ce6f-40e1-8914-c2fc73528361`.**
      Already gated in `AIO_PROJECT_STATE.md` (owner go-ahead required before
      anyone touches it). Bundle with the watchdog work above — once the sweep
      mechanism exists, decide whether it auto-resolves this row or it needs a
      one-off manual close first. Do not touch ahead of explicit owner sign-off.

## R13.1 — P1: high-value, not launch-blocking

- [ ] **Timeout the embedding fetch.** `apps/web/src/lib/hermes/knowledge.ts:58-65`
      (`embedTexts`) has no `AbortSignal`/timeout — an OpenRouter stall hangs
      the whole chat turn. Add the same timeout pattern used elsewhere in the
      orchestrator. Effort: S.
- [ ] **Validate/clamp valve values.** `apps/web/src/app/api/account/valves/route.ts:40-48`
      accepts an unvalidated `Record<string, unknown>` straight into the RPC
      call (`retrieve-context.ts:19-29`) — an out-of-range value (e.g.
      negative `match_count`) silently kills RAG for that user forever with no
      signal. Add range/type validation at the route boundary. Effort: S.
- [ ] **Log RAG failures instead of swallowing them.** `retrieve-context.ts:14,34-36`
      has an empty catch — there is currently no way to tell "is RAG even
      running" in production. Add structured logging on the catch path.
      Effort: S.
- [ ] **Fix the orphaned sidebar divider.** `AppHome.tsx:126` /
      `LeftSidebar.tsx:14-46` — `sidebarCollapsed` defaults to a state that
      renders a bare divider line with no content on every page load unless
      an MCP server is connected. Effort: S.
- [ ] **Fix the "Red" theme accent collision.** `07-templates-modal.css:345`
      duplicates the exact hex of the fixed error/danger token in
      `01-base.css:23` — picking this accent makes every active state look
      like an error. Rename or shift the accent hex. Effort: S.
- [ ] **Fix tablet placeholder clipping.** `04-input-area.css:692-707` —
      composer placeholder text wraps and clips at ~820px width. Effort: S.
- [ ] **Replace raw error surfaces with friendly messages.** Three spots
      leak internals to users: `useWorkspacePanel.ts:146`
      (`hermes_request_failed` literal), `KnowledgeCenterPanel.tsx:47` (bare
      HTTP status as the whole message), `RunEventItem.tsx:61,66-68` (raw
      exception text / raw event-type fallback). Route all three through the
      existing `lib/aio/friendly-fetch-error.ts` pattern already used
      elsewhere. Effort: S, one pass across all three.
- [ ] **Handle checkout/upgrade failure.** `SettingsModal.tsx:200-215` —
      failed checkout only `console.error`s and silently resets the button;
      user has no idea the upgrade attempt failed. Effort: S.
- [x] **Scope Hermes tools per tier — already built, not a gap.**
      `pricing.ts` → `provision.ts`'s `applyTierConfig()` already writes
      per-customer `agent.disabled_toolsets` (native Hermes knob) on every
      respawn. Original audit finding was stale vs. shipped code. Detail:
      `reference_hermes_native_features_for_ui` memory.
- [ ] **Reconcile the approval-manifest vs. actual-enforcement split.**
      `apps/web/src/lib/aio/tools/tool-call-writer.ts` / `tool-policy.ts` — the
      code comment self-admits enforcement is "deferred"; document or close
      the gap between the manifest and what actually gates a tool call, so a
      future editor doesn't have to reverse-engineer which system is real.
      Effort: M (mostly investigation + a decision, then a small patch).
- [ ] **Add test coverage for the RAG/knowledge/valves surface.** Currently
      0% — a single integration test would have caught both P0 schema bugs
      above before merge. Effort: M.

## R13.2 — P2: cleanup, do when touching the file anyway

- [ ] **Breakpoint-resize gap on report/showcase panels** (found 2026-07-08
      during R13.3 reality-check). `AppHome.tsx:861-874` (`openReportPanel`)
      and its sibling `openShowcasePanel` (`:856-860`) decide mobile-modal
      vs. desktop-panel once, at click time, from `isMobileViewport` — a
      static boolean, not derived reactively. Resizing across the 1024px
      breakpoint after opening leaves the panel stale/invisible until
      re-triggered (not a crash). The codebase already has the correct
      pattern elsewhere: `mobileWorkspaceEntry` re-derives from live
      `isMobileViewport` on every render. Fix both `openReportPanel` and
      `openShowcasePanel` to use that pattern instead. Effort: S–M.
- [ ] Collapse `MessageList`/`RightPanel` prop-duplication onto the existing
      `ChatRuntimeContextValue` context instead of receiving the same fields
      twice (`context.ts:19-38`, `MessageList.tsx:41-141`, `RightPanel.tsx:32-142`).
- [ ] Remove the dead `/api/kanban` fetch in `useWorkspacePanel.ts:49-92,222-223`
      — fires every mount, nothing reads the result.
- [ ] Add `.limit()`/pagination to `api/gallery/route.ts:27-31` and
      `api/knowledge/docs/route.ts:29-33`.
- [ ] Decide nav/composer "coming soon" density — 4/9 icon-rail items and
      3/6 composer tray items are disabled stubs; consider hiding rather than
      showing greyed-out for the alpha surface (product call, not pure CSS).
- [ ] Sweep remaining low-severity items logged in the audit artifact: stale
      comment in `AppHome.tsx:915-919`, duplicated field declarations across
      4 layers in `AppHome.tsx:920-1080`, RLS policies on `0032_aio_tool_valves.sql`
      that are dead code under the service-role client, per-profile `.env`
      re-read every turn in `lib/hermes/profile-secrets.ts` (no caching),
      `delegate_tool.py` missing a breadth cap, `prompt-variables.ts:23`
      two-arg `.replace()` gotcha, icon-rail keyboard-tab label clipping.

## R13.3 — Deep Research UX remediation (owner-reported 2026-07-08)

Owner sent 3 screenshots (ChatGPT + Gemini mobile Deep Research) as the bar:
question-specific titled plan card with a checklist tied to the literal
question, live progress checklist during execution, and a separate
timestamped result card ("Open" button) instead of plain chat text. Verdict
after a full-repo audit (fork, 2026-07-08) — all 4 gaps confirmed real, but
two are cheap (existing correct code is just unwired), two are real feature
work.

- [x] **Swap the wired progress card (cheap win, do first).** Done
      2026-07-08. `MessageList.tsx` now points at
      `run-timeline/ResearchProgressCard.tsx` (dynamic per-search steps) via
      a new `ResearchCardShell` wrapper; old hardcoded-4-step
      `apps/web/src/components/app/ResearchProgressCard.tsx` deleted
      (confirmed zero remaining importers). Verify: `tsc --noEmit` clean,
      Playwright green, live-verified by reality-check.
- [x] **Route the final report to the Workspace preview panel instead of
      the chat bubble.** Done 2026-07-08. Chat bubble now shows a
      `reportSummary()` teaser + "Open report" button; full report +
      sources + MD/PDF export moved into the existing Workspace terminal
      "preview" tab (desktop) / a new modal (mobile), via `RightPanel.tsx`'s
      `renderReportBody()`. Two review rounds (kimo + qa-reviewer) found and
      fixed: invisible export buttons outside chat context (CSS opacity),
      `reportSummary()` heading-glue + mid-word truncation, double-border on
      the progress card, icon collision, dead CSS (2 files), and stale
      `openReport`/`openShowcase` state on conversation switch (now reset in
      `useConversations.ts`). Reality-checker verdict: READY, HIGH
      confidence, live Playwright run confirms buttons visible/clickable.
      **Known follow-up, not fixed here:** resizing across the
      mobile/desktop breakpoint while the report/showcase panel is open
      doesn't re-route it (stale/hidden, not a crash) — pre-existing pattern
      shared with `openShowcase`'s identical bug, needs a broader fix
      touching shared panel-visibility logic. Tracked as a new R13.2/P2 item.
- [~] **Add an upfront, question-specific plan step — backend half done
      2026-07-08.** `research-mode.ts`'s `generateResearchPlan()` makes one
      cheap `anthropic/claude-haiku-4.5` OpenRouter call (same base/pattern as
      `hermes/knowledge.ts`'s embeddings call) at research start, before the
      main read loop, turning the literal query into strict JSON
      `{ title, steps[] }` referencing the query's actual entities (prompted
      against generic "search/read/synthesize" boilerplate). Written into the
      previously-dead `research_plan` metadata field via
      `updateResearchProgress()` and carried on the existing `research.stage`
      SSE event's new `plan` field (`ResearchPlanPayload` in
      `aio-run-events.ts`) — no new event type, reuses item 1's pipe.
      **Owner-call default applied: auto-starts research immediately, no
      "Edit plan / Start research" confirmation gate** — faster, matches the
      rest of the flow's auto-start behavior; request the confirmation-gate
      version explicitly if a closer Gemini-match is wanted later (adds a
      round-trip turn). `tsc --noEmit` clean, 283/283 unit tests pass
      (7 new in `research-mode.test.ts` covering JSON parse/guard paths).
      Live smoke test attempted but blocked by a 401 ("User not found") from
      the `aio` profile's `OPENROUTER_API_KEY`. **Owner action needed:**
      product-ux-guardian flagged this as more than a one-off test glitch —
      if this key is actually broken in the live `aio` profile (not just
      this session's shell), the plan card will silently never appear for
      any real user (best-effort/silent-fail by design), with no visible
      signal that anything is wrong. Confirm the key resolves in the live
      profile before treating this item as working end-to-end.
      **Frontend done same day:** `ResearchPlanCard.tsx` (new,
      `run-timeline/`) renders `plan.title`/`plan.steps`, wired into both
      `RunEventItem.tsx` (standalone timeline) and `MessageList.tsx` (chat
      flow, 2 call sites), gated on `plan` being present — degrades silently
      to progress-card-only when absent. kimo review found 2 Major + 1 Minor
      (plan-title/stage-label typography indistinguishable at a glance,
      double-border in the standalone `RunEventItem` usage, plan title has
      no line-length ceiling unlike the shell's question header) — **all 3
      fixed same day** by frontend-builder: plan-card header demoted to a
      muted preface style (new `.research-plan-heading`/`.research-plan-title`
      classes, icon-chip dropped) so `ResearchProgressCard` keeps the
      strongest "current status" weight; `RunEventItem.tsx` now wraps plan+
      progress in one single-bordered container (`bare` on both children,
      mirroring `ResearchCardShell`'s pattern) instead of two glued cards;
      plan title now clamps to 2 lines (`-webkit-line-clamp`, matching
      `05-right-panel.css`'s existing clamp convention). `tsc --noEmit`
      clean, `research-export.spec.ts` 2/2 passed (desktop+mobile).
      **Not independently verified:** no manual/screenshot check of the
      `RunEventItem` standalone timeline render — the passing E2E spec
      doesn't specifically assert on that path's new styling, only on
      export controls.
- [~] **Enforce actual research depth — backend half done 2026-07-08.**
      `RESEARCH_INSTRUCTIONS` now states a non-negotiable minimum of
      `MIN_RESEARCH_SOURCES = 4` distinct sources before synthesis (picked as
      the middle of the 3-5 range implied by competitor Deep Research modes).
      Checked investigation finding: **no cheap/clean code-level interception
      point exists** — there is no explicit "finish research" tool call to
      gate, and truncating an in-flight `message.delta` stream to force more
      searches would be a worse UX regression than an occasional shallow
      miss. Added a cheap code-level signal instead (not a blocker): a
      `console.warn` in `run-orchestrator.ts` at the `message.delta`
      text-start interception point if `researchSourceIds.size` is still
      below the floor when synthesis begins, using the already-tracked
      counter — visibility for the eval, not enforcement. `tsc --noEmit`
      clean, existing tests pass. **Explicitly not verified: a real
      before/after quality eval** — this pass only confirms the guardrail is
      wired correctly and doesn't break the existing flow, not that it
      improves answer quality or is latency-free; that eval is still an open
      item.

Full audit detail (file:line citations for every claim above): fork report
2026-07-08, "Audit Aio's Deep Research feature vs ChatGPT/Gemini UX."
R9's MD/PDF export + sources panel are confirmed live (not dead code) — just
attached to the wrong surface, per item 2 above.

## Sequencing

1. **Start immediately, in parallel, no gate needed:** the three ungated P0
   items (knowledge-route schema fix, approval wiring, run watchdog) — all
   mechanical or pattern-copying, no design spike required.
2. **Resolve Gate A and Gate B early** — both P0 items behind them are the
   largest remaining pieces of work and the most owner-judgment-dependent;
   the sooner they're decided, the sooner they can start in parallel with
   step 1.
3. **P1** after P0 closes — the friendly-error pass and the sidebar/CSS fixes
   are cheap enough to fold into whichever P0 branch is already touching
   nearby files.
4. **P2** opportunistically, no dedicated pass required.

## Open decision gates (owner)

- **Gate A — resolved 2026-07-08.** Owner picked 🅰️ per-customer profile.
  Turned out to already be built and live (`provision.ts` + `hermes_registry`)
  — the shared "aio" profile only leaks through the local-dev auth-bypass
  flag. See R13.0 above for the resulting verify/config/TODO items.
- **Gate B — Connected Apps / Model Providers fate.** Hide from non-owner
  accounts now (S, ships with this phase) vs. invest in a real OAuth-style
  redesign (M–L, likely its own follow-up). Blocks that P0 item.
- **Gate C (pre-existing, `AIO_PROJECT_STATE.md`) — internal knowledge → Hermes
  tool wiring timing.** Not blocking the schema fix itself (fix regardless,
  it's dead-but-wrong code), but decides whether T1.3 (knowledge-as-tool)
  gets scheduled in this phase or stays deferred.
- **Stuck run `66a29fab-ce6f-40e1-8914-c2fc73528361`** — owner go-ahead
  required before touching, per existing gate in `AIO_PROJECT_STATE.md`.
