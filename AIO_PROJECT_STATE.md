# Aio Project State

**Canonical repository:** `/home/swegon/AI_Agent/Aio_project`  
**Canonical branch:** `main`  
**Current main status:** run `scripts/aio-context.sh` for the exact live HEAD
**Most recent verified CI before this state update:** GitHub Actions run `28318122604`, all jobs passed
**Updated:** 2026-07-05 (R11.5 UI/UX polish pass — R11.5a + R11.5b — done and
Playwright-verified, closing out R11; Product-Ready hardening plan kicked
off with 6 specialist agents across Phase 1/2/4/5, findings folded into
`docs/roadmap/PRODUCT_READY_MASTER_PLAN.md`; one live stuck-run bug flagged,
not yet fixed. Detail in `docs/roadmap/R11_EXECUTION_CHECKLIST.md`)

This is the first file an agent reads to learn current location and progress.
It is a status index, not a replacement for the master plan or phase checklist.

## Current Status

- R0-R9 are all closed/merged on `main`. One-line-per-phase summary (see each
  phase's `docs/roadmap/R*_EXECUTION_CHECKLIST.md` if historical detail is
  ever needed — not required for day-to-day work):
  - **R0** CI/production safety closure. **R1** durable run foundation.
    **R2** tool governance + durable approvals. **R3** observability/SLOs.
    **R4** durable deep research + knowledge pipeline. **R5** background
    workers + scheduled tasks (incl. R5.5 failure/recovery). **R6**
    consumer beta readiness (onboarding, auth/tenant hardening, billing,
    export/delete, ops, analytics). **R7** Saved Agents.
  - **R8** beta-readiness hardening, complete; R8.5 resolved as
    per-customer, Aio-provisioned OpenRouter keys with a spend ceiling
    (migration `0025`, applied).
  - **R9** Deep Research polish, complete: durable 7-stage research
    pipeline, source dedupe, MD/PDF export, per-message sources panel.
    Deferred: claim-level citations, DB-level dedupe constraint.
  - All migrations `0001`-`0025` applied remotely. Owner close-out items
    (Paddle sandbox, legal review, alert transport, backup drill) tracked
    at `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`, don't block engineering.
- Standing decisions still in force: keep R5/R6/R7 on one delivery branch;
  don't rewrite git history for old `.mcp.json` secret exposure (current-tree
  protection + CI scanning is the closure boundary); keep the product line
  on `main`, no new phase-specific worktrees unless owner asks.
- `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md` (added 2026-07-02): 5-phase
  hardening checklist for "could flip to public anytime" (no public
  marketing/i18n yet). Runs parallel to R11, doesn't block it. Kicked off
  2026-07-05: 6 read-only specialist agents audited Phase 1 (SLO/
  observability/cost/load-test-design/alert/backup cross-checks), Phase 2
  (ToS acceptance, data map, breach-response readiness), Phase 4
  (analytics coverage), and Phase 5 item 1 (market/competitive check) —
  all findings folded directly into that file's checklist items (design/
  audit only, no code changed by these agents). Phase 3 and Phase 5's
  `sprint-prioritizer` item remain deferred (need Phase 1 baseline / the
  combined Phase 1-4 item list respectively). 🚨 One live issue surfaced
  incidentally, not yet fixed: run `66a29fab-ce6f-40e1-8914-c2fc73528361`
  has been stuck in `running` status since 2026-07-03T09:12:22Z (45+
  hours as of discovery), uncaught by the supervisor — needs owner
  go-ahead before anyone touches it, since it's live in-progress state.
- A multi-runtime idea (DeerFlow/Onyx/OpenHands alongside Hermes) was
  **explicitly deferred** after a grill (2026-07-03) — see
  `docs/roadmap/FUTURE_MULTI_RUNTIME_CANDIDATE.md`. Revisit after
  Product-Ready Phase 1. Not active; don't build from the report.
- Aio Team OS: `bash scripts/aio-team-os.sh progress` / `status` / `doctor`
  for the local Team OS operating surface (last verified doctor-clean).
- Local always-on stack: `scripts/aio-online.sh install|start|restart|status|logs|stop`
  manages `aio-hermes.service`, `aio-hermes-supervisor.service`, `aio-app.service`.

### R10 — active, in flight on `feat/r10-notifications` (uncommitted)

- **R10.2 (Proactive Notifications)**: complete (`3d45fb9`, `77fb3db`) —
  migration `0026`, notifications API + `NotificationsPanel` + unread badge,
  Discord toggle in `ScheduledTasksModal`. Verified: typecheck/lint,
  258/258 unit tests.
- **R10.1 (Google Calendar Connect)**: engineering + UI-verification
  complete (2026-07-03) — OAuth routes, `google-calendar.ts`, migration
  `0027`, vault-backed refresh token, Settings connect/disconnect card.
  Owner's Google Cloud setup done; server-side OAuth live-verified.
  Playwright self-test (`google-calendar-connect.spec.ts`) + Kimo UI
  review together found and fixed 8 real UI bugs (CSS flex-squeeze hiding
  status text — same bug recurred in `NotificationsPanel.tsx`; stale-tab
  bug after OAuth callback; Critical: Settings unusable on mobile;
  error-color/accent collision; invisible delete-account border;
  accent-swatch mismatch; inconsistent input styling; raw error text).
  Full list + evidence: `docs/roadmap/R10_EXECUTION_CHECKLIST.md` "R10.1".
  Verified: `tsc` clean, lint clean, 258/258 unit, 12/12 Playwright e2e.
  One flagged gap not fixed: no retry affordance on error states.
- **Open blocker, needs owner go-ahead**: `/api/notifications` and
  `/api/connections/google` 500 in the live dev app — migrations `0026`/
  `0027` exist locally but were never pushed to the linked remote Supabase
  project (confirmed via `supabase migration list --linked`). Not a code
  bug. Pushing is a shared-DB change — needs explicit approval.
- **Home-screen UI fixes + Deep Research checklist (2026-07-03, Discord-
  reported, uncommitted on this branch)**: two owner-reported issues fixed
  in `AppHome.tsx`/`RunTimeline.tsx`/`ResearchProgressCard.tsx`:
  1. Removed the "N memory notes available" / "No recent activity" pills
     and the stray single-word `message.delta` entries flooding the
     "Current Run" timeline (`RunTimeline.tsx` now filters
     `event.type !== "message.delta"` from the rendered list while still
     feeding the unfiltered list to the mascot-state heuristic); "Today"
     tab suggestion cards now only render when backed by real data instead
     of always showing fabricated defaults.
  2. Deep Research progress card (`ResearchProgressCard.tsx`) now renders a
     real, query-specific checklist (actual search queries, actual source
     hostnames read, "Writing the report") with done/active icons, replacing
     the old static 7-label pill row — additive `steps?: ResearchStep[]`
     field on `ResearchStageEvent` (`aio-run-events.ts`), populated in
     `run-orchestrator.ts` from real tool-call previews/result URLs (no
     invented progress). Old persisted events without `steps` still render
     via the original 7-pill fallback.
  Evidence: `tsc --noEmit` clean, lint clean, `npm test` 258/258 passing,
  curl-confirmed the dev server still serves `/app` (200 OK, no 500). Not
  yet live-verified in a browser — Chrome MCP extension was disconnected
  this session; awaiting owner manual check of both items against their
  reported screenshots (`deep.jpeg` for item 2).
- **Quick-suggestion chips (2026-07-03, Discord-requested, uncommitted)**:
  up to 3 small suggestion chips render directly above the composer,
  derived from the real last-assistant-reply text (code fence -> "Refine
  the code", >=2 list items -> "Turn into a plan", URL present -> "Dig
  deeper on sources", always includes a "Continue this" fallback so the
  row only shows when there is real conversation to base it on — same
  no-fabricated-defaults pattern as the Today cards).
  `deriveQuickSuggestions()`/`quickSuggestions` in `AppHome.tsx`, styles in
  `mockup.css` (`.quick-suggestions`/`.quick-suggestion-chip`). Clicking a
  chip fills the composer (does not auto-send), same UX as the existing
  Today-card "plan" action. New Playwright spec
  `apps/web/e2e/quick-suggestions.spec.ts` (2 tests x 2 viewports, 4/4
  passing) verifies: chips render above `textarea.message-input` only
  after a real reply exists, capped at 3, and clicking one fills the
  textarea. Evidence: `tsc --noEmit` clean, lint clean (no new warnings),
  `npm test` 258/258, `npx playwright test quick-suggestions` 4/4 passing.
- **Context-load optimization + hooks (2026-07-03, Discord-requested,
  uncommitted)**: user flagged too much per-session file reading.
  - `CLAUDE.md`/`AIO_PROJECT_STATE.md` "Start Here"/"Required Reading Order"
    now list `AIO_MASTER_EXECUTION_PLAN.md` and
    `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md` as on-demand reads, not
    every-session — kept both files in place (15 files reference the master
    plan's path; moving it was too much blast radius for a context-only
    change). `scripts/aio-context.sh`'s "Read next" no longer lists the
    master plan either.
  - Extracted the quick-suggestions block out of `AppHome.tsx` into
    `apps/web/src/components/app/QuickSuggestions.tsx`
    (`deriveQuickSuggestions`, `QuickSuggestionsBar`) as a first, contained
    slice of the larger "split AppHome.tsx" idea — full decomposition of the
    ~4.3k-line file is a separate, bigger follow-up, not attempted here.
  - Added project-scoped hooks in `.claude/settings.json` (was `{}`):
    `PostToolUse` (`Edit|Write`) runs scoped `eslint` on the just-edited
    `.ts`/`.tsx` file under `apps/web` and only prints output when it finds
    something (`.claude/hooks/post-edit-lint.py`); `UserPromptSubmit`
    detects the "continue building Aio" phrase and runs
    `scripts/aio-context.sh` directly, injecting its real output
    (`.claude/hooks/continue-aio-context.py`) — a hook can't force a Skill
    invocation, but it can execute the underlying script itself and hand
    the model real data instead of relying on it to remember to run
    something.
  Evidence: `tsc --noEmit` clean, lint clean (no new warnings), `npm test`
  258/258, `npx playwright test quick-suggestions` 4/4 passing (after the
  AppHome.tsx extraction), both new hook scripts smoke-tested standalone
  with synthetic stdin payloads.
- **AppHome.tsx split, slice 2 (2026-07-03, Discord "tách apphome tiếp
  đi", uncommitted)**: extracted the Terminal/Files preview module out of
  `AppHome.tsx` into `apps/web/src/components/app/FilePreview.tsx`
  (`ActiveFile` type, `ShowcaseErrorDetail`, `PreviewPane`,
  `useArtifactFetch`, `PdfPreview`, `DocPreview`, `SheetPreview`,
  `MarkdownPreview`, `LiveAppPreview`, plus the extension-matching `Set`
  constants) — verbatim code motion, no logic changes. `AppHome.tsx`
  ~4330 → ~4009 lines. Caught and fixed one extraction mistake before
  landing: `KEYWORDS`/`escapeHtml`/`highlightCode` (used by AppHome's own
  chat code-block rendering, unrelated to the file-preview panel) were
  inside the moved line range but not part of the intended block —
  `tsc` surfaced the miss immediately, restored in place. Full
  decomposition of the ~4k-line file remains open; next candidate is the
  Terminal/Activity feed block. Evidence: `tsc --noEmit` clean, lint
  clean (same 4 pre-existing warnings, no new ones), `npm test` 258/258.

### R11 — active, in flight on `feat/r11-settings` (uncommitted)

Scope locked via 5 grill-me rounds (2026-07-03/04); full detail, per-item
evidence, and the 32-item Hermes capability audit resolution are in
`docs/roadmap/R11_EXECUTION_CHECKLIST.md`. Summary:

- **R11.1 Settings redesign** `[x]`: Account/Notifications/Memory tabs +
  data-training opt-out toggle shipped (migrations `0028`-`0029`,
  repositories, API routes). Custom Instructions was already shipped
  pre-R11 (`SavedAgents.instructionsAddition`) — no new work needed there.
  Migrations pushed to remote Supabase (see below). Live-verified via
  Playwright (`e2e/r11-settings-and-vision.spec.ts`): Notifications toggle,
  Memory tab fact create, Account tab read-only display — 3/3 passing.
- **R11.2 Composer "+" tray** `[x]`: card-grid popover redesign, done and
  live-verified (Playwright desktop+mobile).
- **R11.3 Terminal/Workspace panel polish** `[~]`: code-block overflow/
  height-cap fixes, free drag-resize, taller panel, two-layer background
  principle (single dot-grid, no element gets its own background), snug
  sidebar card, top-bar removal with floating chrome, delegation-merged
  status line, read-only MCP sidebar ("Integrations", no "MCP" wording) —
  all done, code-verified + live Playwright-verified. Two real bugs found
  and fixed during this pass: a CSS `transition` catching the new
  drag-resize width (panel lagged ~9x behind the pointer), and the
  two-layer background change bleeding into the mobile sidebar overlay
  (made it illegible) — both fixed and re-verified.
- **R11.4 Terminal architecture research** `[x]`: Manus/OpenManus/Onyx/
  DeerFlow studied; recommendation is to keep evolving `RunTimeline`/
  `ToolCallCard` in place (no code worth vendoring), adopt the
  collapse-by-default aggregate-header pattern. Full writeup:
  `docs/roadmap/R11_TERMINAL_ARCHITECTURE_RESEARCH.md`.
- **Spend-cap sub-limits (#4/#5)** `[x]`: `checkToolSubLimit`/`getToolSpendUsd`/
  `getToolSubLimitUsd` implemented (migration `0030`, dollar-based, same
  model as the existing R6.8 spend cap). Fixed a real supabase-js `.in()`
  bug and a missed `browser` plan-tier gap along the way. Wired to the one
  real per-tool-call interception point: `POST /api/chat/approval` looks up
  the pending `aio_approvals` row's `tool_name` and calls
  `checkToolSubLimit` before forwarding an approve-type choice, auto-
  denying to Hermes and returning `402 tool_sub_limit_exceeded` when over
  limit. Migrations `0028`-`0030` pushed to remote Supabase.
- **#6 Vision** `[x]`: cross-plane image-input landed 2026-07-04. Wire
  contract — `chat-route-handler.ts`, `run-orchestrator.ts`,
  `hermes-client.ts` (Next.js) and `/v1/runs` in `api_server.py` (Hermes,
  now reuses `_normalize_multimodal_content` for input + history instead
  of flattening images out). Composer UI — "Attach → Photos & files" card
  enabled; file-picker/drag-drop/paste all produce `FileUIPart[]`, capped
  4 images/8MB each, thumbnail chip row, wired into `sendMessage`.
  Verified: tsc/eslint/py_compile clean, `npm test` 261/261. Live-verified
  via Playwright (file-picker path): attach → thumbnail chip → sent with
  correct `FileUIPart`/data-URL payload, 8MB guardrail, 4-image cap — 3/3
  passing. Drag-drop/paste share the same code path, not separately
  exercised.
- **Open owner decision gates**: (a) #18 Research — SwegOn explicitly
  deferred pending more research, not blocking.

R11.1-R11.4 have no remaining substantive engineering work — all four
tracks (plus #3-6, #8, #14, #17) are code-complete and live/Playwright-
verified (full e2e suite 20/20 green, including a fix for an unrelated
pre-existing `app-smoke.spec.ts` selector drift). Only #18 Research
remains open there, owner-deferred, not blocking.

- **R11.5 UI/UX polish pass** `[x]` (scoped 2026-07-04, done 2026-07-05):
  post-launch background-gradient bug fixed directly (`01-base.css`); then
  5 specialist agents (`kimo` ×2, `accessibility-auditor`,
  `product-ux-guardian`, `ux-researcher`) audited the full `/app` UI —
  scores 6/10 overall, 4.5/10 accessibility (NEEDS WORK), 6.5/10
  product/UX, 6.5/10 usability. **R11.5a** (11 CSS/token/copy items) and
  **R11.5b** (6 of 7 component/logic items: sidebar New-Chat/toggle
  consolidation, shared `useFocusTrap` hook on the 3 real dialogs,
  `aria-live`/`role=status` regions, `friendlyFetchError()` helper,
  `RunTimeline` chrome declutter, Model Providers capability-grouping
  reframe) are both implemented and verified: `tsc --noEmit` clean, lint
  0 errors/306 pre-existing warnings, Playwright green both against the
  full suite (agent-run, matched pre-existing baseline failures) and an
  independent 9/9 desktop-chromium spot-check
  (`app-smoke.spec.ts`/`r11-settings-and-vision.spec.ts`) re-run after
  landing. Onboarding no-op question deliberately left open, out of
  scope. External references `assistant-ui`/`open-webui` researched, no
  code adopted. Full itemized list, scores, and evidence:
  `docs/roadmap/R11_EXECUTION_CHECKLIST.md` § R11.5.

## Worktree Roles

- `/home/swegon/AI_Agent/Aio_project`
  - Canonical product repository.
  - Use `main` for product truth; use `feat/aio-team-os` only for local
    operational hardening that does not redefine product phase approval.
  - Use for integration, verification, and running Aio.
  - Use `scripts/aio-online.sh status` to confirm the local always-on stack.
- `/home/swegon/AI_Agent/Aio_project_onyx_openmanus_lab`
  - Research-only worktree for Onyx/OpenManus.
  - Keep it isolated from product implementation.

## Required Reading Order

1. `AIO_PROJECT_STATE.md`
2. Current phase checklist under `docs/roadmap/`
3. `AGENTS.md`
4. `README.md`

Read on demand, not every session: `AIO_MASTER_EXECUTION_PLAN.md` (full R0-R7
contract, all closed phases — this file's "Current Status" section already
summarizes the outcome) and `docs/roadmap/PRODUCT_READY_MASTER_PLAN.md`
(only when a task is in that parallel hardening lane).

## Meaning Of "Continue Building Aio"

When the product owner says "continue building Aio":

1. Run `scripts/aio-context.sh`.
2. Confirm the canonical repo, branch, local/remote commit, dirty state, CI, and
   service status.
3. Read this state file and the current phase checklist.
4. If a phase is already merged, do not keep coding in its old worktree.
5. If an approved task is marked in progress, continue that exact task.
6. If no task is approved, do not start coding. Present the next decision gate
   with concise A/B/C options and mark the recommended option.
7. After approval, create a dedicated branch/worktree from current
   `origin/main`; never implement a feature in the research worktree.
8. Implement, test, review, push, and put Aio online.
9. Update this file and the phase checklist after merge.

## Next Decision Gate

R10 is approved (owner grill decision, 2026-07-02, Discord — "1b 2a"),
sourced from three parallel research forks (market landscape, tools/repos,
internal gap audit) synthesized into a two-question grill. See
`.claude/grill-logs/grill-log-next-flagship-phase-2026-07-02.md` for the
full record and `docs/roadmap/R10_EXECUTION_CHECKLIST.md` for scope:

- Primary flagship: **Google Calendar consumer connect flow** (OAuth,
  Calendar-only for this pass — Gmail/Drive deferred pending a Google CASA
  restricted-scope review, a compliance step, not an engineering one).
- Parallel: **Proactive notifications** — closes the R5.4 "notification
  destination" field that was spec'd but never built for Scheduled Tasks.

R10.2 (notifications) has no external blocker and can start immediately.
R10.1 (connect flow) needs an owner-only Google Cloud OAuth app + consent
screen setup before it can be live-verified end to end; engineering can
proceed on routes/migration/UI shell in parallel — see the checklist's
"Owner-only" section.

R8 (Beta-Readiness Hardening) and R9 (Deep Research Polish) are both
complete — see `docs/roadmap/R8_EXECUTION_CHECKLIST.md` and
`docs/roadmap/R9_EXECUTION_CHECKLIST.md`. The R8.5 per-customer-key model
decision is resolved and implemented (OpenRouter; see "Current Status"
above) — its remaining steps are owner-only env/migration actions, not an
open engineering decision.

Deferred, not part of R10 (may resurface as a future gate):

- Claim-level citations for Deep Research (deliberately deferred from R9):
  wire `recordResearchClaim` with a new LLM-driven claim-extraction step.
- Extend per-customer key isolation to Daytona, or wire
  `updateOpenRouterKeyLimit` into the billing webhook for tier-change
  spend-ceiling sync.

The owner-side close-out checklist
(`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`) runs in parallel and does
not block engineering work — same standing sequencing preference used
since R6/R7 ("owner tasks don't block code work").

- keep any new implementation out of the research worktree

## Update Contract

The integrating agent must update this file whenever:

- a phase or feature is approved
- a new implementation worktree is created
- a task becomes blocked
- a branch is merged
- CI status materially changes
- canonical paths or runtime commands change

Do not record secrets, raw provider responses, personal prompt content, or
uncommitted runtime-state details here.
