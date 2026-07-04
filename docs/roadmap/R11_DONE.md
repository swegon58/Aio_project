# R11 Completed Work (R11.1–R11.4) — archived from R11_EXECUTION_CHECKLIST.md

Split 2026-07-04 to keep the active checklist lean: this file holds every
R11 track that shipped and was verified (R11.1 Settings, R11.2 Composer
tray, R11.3 Terminal polish, R11.4 Terminal architecture research). The
active file (`R11_EXECUTION_CHECKLIST.md`) now only carries R11.5 (open
work) plus a one-line pointer here. See that file's header for the original
trigger/scope context.

## R11.1 — Settings Redesign [x]

Locked additions (the 5 candidates marked "worth adding now" out of 10
surveyed against ChatGPT/Claude.ai/Gemini/Perplexity settings):

- [x] **Notifications tab** — re-surface the existing R10.2 backend
      (`notification-repository.ts`, Discord toggle currently buried inside
      `ScheduledTasksModal`) as a first-class Settings tab instead of
      per-schedule only.
- [x] **Account/Profile tab** — name/email/avatar, backed by Supabase auth
      user metadata. Avatar scope confirmed 2026-07-04: **display-only**, no
      upload flow this pass.
- [x] **Memory tab** — view/edit/delete facts Aio auto-learned about the
      user; distinct from the existing Knowledge/RAG tab. Needs new backend
      storage + API — no existing auto-memory infra for end users was found
      in `apps/web/src` during the audit.
- [x] **Custom Instructions — scope corrected 2026-07-04**: this is **already
      shipped**, not new work. `apps/web/src/lib/aio/saved-agents/saved-agents.ts`
      already has a full `SavedAgent.instructionsAddition` field (DB column
      `instructions_addition`), CRUD with `MAX_INSTRUCTIONS_LENGTH`
      validation, and is already wired into the system prompt at
      `run-orchestrator.ts:224`
      (`savedAgent?.data.instructionsAddition`). The UI already exists too —
      `SavedAgentsPanel.tsx` (a working `<textarea>` bound to
      `draft.instructionsAddition`) is already mounted inside
      `SettingsModal.tsx:499`, and `SavedAgentMenu.tsx` (agent picker) is
      already in the composer (`AppHome.tsx:3369`). SwegOn confirmed
      per-agent scope (not global) — which is exactly what this feature
      already does. **Resolved 2026-07-04**: the `github.com/msitarzewski/
      agency-agents` question is closed — SwegOn confirmed those 16 agents
      are internal build tooling only (Claude Code subagents used to build
      Aio), never surfaced to end users. No integration with SavedAgents;
      this was a project-memory conflation, not a real feature gap.
- [x] **Data-use/training opt-out toggle** — new boolean flag alongside the
      existing export/delete controls in Data & Privacy.

Explicitly deferred (do not build this pass): Security/2FA, Language/locale
(no-i18n is already locked per `CLAUDE.md` / `PRODUCT_READY_MASTER_PLAN.md`),
Billing/invoice history, Accessibility tab as a settings destination (a11y
work itself is not deferred — see `accessibility-auditor`), Voice/TTS.

### Hermes capability decisions (32-item audit, resolved 2026-07-04)

The raw 32-item list is retired — SwegOn's per-item calls below are what's
actionable. Anything not named here was in the "còn lại bỏ qua" (skip the
rest) sweep and is not being built in R11.

**New build items (beyond R11.1/R11.2 above):**

- [x] **#3 Clarify/Plan Mode** — resolved 2026-07-04 (research spike):
      Hermes has no generic "propose plan, then confirm" convention that
      fits a consumer chat clarify step. `apps/harness/aio-home/skills/
      software-development/plan/SKILL.md` is a coding-agent implementation-
      plan skill (wrong domain). The `/v1/runs` HIL approval gate
      (`api_server.py:3846,4334` + `tools/approval.py`) only gates dangerous
      terminal/execute_code commands over a different API surface
      (`/v1/runs`, not Aio's `/api/sessions/{id}/chat*`), and is already
      tracked separately as backlog
      (`apps/harness/docs/decisions/run-approval-hil-backlog.md`). Decision:
      keep Aio's own `apps/web/src/lib/aio/chat/plan-mode.ts` (already
      built, wired in `run-orchestrator.ts:283,363`) as-is. No build needed.
- [x] **#4 Code Execution** — surface it directly; the existing "running
      code" chip is enough, no dedicated screen needed for this pass.
      Confirmed 2026-07-04: opened to **all pricing tiers**, not Pro+-gated.
      `tool-manifest.ts`'s `code_execution` entry already had
      `planAvailability: ALL_PLANS`. Spend-cap sub-limit implemented and now
      **wired** (see `[x] #5` evidence below — same function/route covers
      both tools).
- [x] **#5 Browser Automation** — same as #4: surface directly, no dedicated
      screen/session-history UI needed this pass. **Fixed 2026-07-04**:
      `tool-manifest.ts`'s `browser` entry was still `planAvailability:
      ["pro", "business"]` (missed in an earlier pass) — changed to
      `ALL_PLANS` to match the confirmed decision. Also fixed a stale unit
      test (`tool-policy.test.ts`: "starter cannot access browser
      automation" → now asserts starter *can*, per this decision).
      `checkToolSubLimit`/`getToolSpendUsd`/`getToolSubLimitUsd` implemented
      in `spend-cap.ts` (dollar-based, defaults $10 code_execution / $20
      browser, `aio_tool_sub_limits` table from migration `0030`). Found and
      fixed a real bug during review: `getToolSpendUsd`'s original
      `.in("id", db.from(...).select("run_id")...)` passed a
      `PostgrestFilterBuilder` where supabase-js requires a plain array
      (`tsc` TS2345) — restructured into a two-step query (fetch run_ids as
      an array first, dedupe via `Set`, then `.in("id", runIds)`).
      **Wired 2026-07-04** at the real interception point: `POST
      /api/chat/approval` (`src/app/api/chat/approval/route.ts`) is the one
      place Next.js mediates a specific tool call before Hermes proceeds —
      it's the proxy for Hermes's mandatory-approval gate
      (`_handle_run_approval`) that every code_execution/browser call must
      pass through. On an approve-type choice, the route now looks up the
      pending `aio_approvals` row for the run (`listApprovalsForRun`) to
      read its `tool_name`, calls `checkToolSubLimit`, and if the customer
      is over their sub-limit it auto-forwards `deny` to Hermes (so the
      paused run doesn't hang) and returns `402 tool_sub_limit_exceeded` to
      the client with spent/limit amounts instead of the normal proxy
      response. Non-gated tools and `deny` choices skip the check entirely
      (`checkToolSubLimit` short-circuits to `ok: true` for ungated tools).
      Verified: `tsc --noEmit` clean, `eslint` clean, `npm test` 261/261.
- [x] **#6 Vision** — built 2026-07-04, both halves landed:
      **Wire contract** (Next.js ↔ Hermes): `chat-route-handler.ts`'s
      `buildRuntimeMessages` now emits `AioRuntimeContentPart[]`
      (`text`/`image_url` parts, base64 data URLs) instead of filtering to
      text only; `run-orchestrator.ts` no longer `String()`-coerces content,
      passing array-shaped multimodal content through unchanged;
      `hermes-client.ts`'s `StartHermesRunInput` widened to
      `string | AioRuntimeContentPart[]`. On the Hermes side, `/v1/runs`
      (`api_server.py`) now reuses the existing `_normalize_multimodal_content`
      (previously only used by `chat_completions`) for both the current
      input and every `conversation_history` entry, so images survive
      across turns instead of being flattened; malformed image payloads
      return the standard OpenAI-style 400 via `_multimodal_validation_error`.
      **Composer UI**: the R11.2 "Attach → Photos & files" tray card is
      enabled (file picker via hidden `<input type="file" accept="image/*"
      multiple>`), plus drag-drop on `.input-wrapper` and paste on the
      textarea — all three paths funnel through one `addAttachments`
      helper producing `FileUIPart[]` (FileReader → data URL), capped at
      4 images / 8MB each with an inline error message. Attachments render
      as a thumbnail chip row (reusing `.image-reference-chip` styling)
      above the input, each removable; `handleSubmit` passes
      `sendMessage({ text, files: pendingAttachments }, ...)` and clears
      attachments after send; send button no longer requires text if
      attachments are pending. Verified: `tsc --noEmit` clean, `eslint`
      clean (pre-existing unrelated warnings only), `npm test` 261/261,
      `python3 -m py_compile` clean on `api_server.py`. **Update
      2026-07-04 (Playwright pass)**: live-verified via
      `apps/web/e2e/r11-settings-and-vision.spec.ts` (attach → thumbnail
      chip → sent with correct `FileUIPart`/data-URL wire payload; 8MB
      per-file guardrail; 4-image cap) — 3/3 passing. File-picker path
      confirmed end-to-end; drag-drop/paste paths share the same
      `addAttachments` helper and were not separately exercised by the
      spec.
- [x] **#8 Task Delegation** — confirmed 2026-07-04: **do not** build a
      separate status graphic. Merge into the existing chat-timeline/
      status-line element (see "Status-line shimmer" section below) and
      include an Aio mascot image/icon in that merged status line. Done:
      regex heuristic (`/delegat/i` on `runningTool.tool`) in `AppHome.tsx`
      reuses the existing `agent-info-avatar` mascot icon for the merged
      status line — no separate graphic built.
- [x] **#14 MCP Integrations** — surface it: placement confirmed **left
      sidebar**, **read-only display** (no self-serve add/remove UI this
      pass — confirmed 2026-07-04), drop the word "MCP" from user-facing
      copy (too technical), needs its own UI design pass. Done: reuses the
      real `GET /api/integrations/mcp` route (Hermes `config.yaml`-backed,
      no stub) and existing `.mcp-server-item` CSS; labeled "Integrations"
      (no "MCP" wording), shows server name + connected/disconnected dot,
      section hides when list is empty, `transport` field deliberately
      omitted from display (`ponytail:` noted in code) to avoid leaking
      backend detail.
- [x] **#17 Productivity** — bundling entry point resolved via the Google
      Workspace card in R11.2 Build & work section; final placement, no
      objection raised.
- [ ] **#18 Research** — should be built; distinct from Deep Research
      (broader — arXiv, market, blog tracking). SwegOn deferred 2026-07-04:
      "cần nghiên cứu rõ hơn, chưa làm ngay được" — the merge-into-Deep-
      Research vs. separate-entry-point question is **not decided yet**,
      needs more research before the next grill round on this item. Not
      blocking the rest of R11.

**Already resolved elsewhere in this file:** #7 Memory → R11.1 Memory tab;
#9/#10 Image/Video generation → R11.2 Create cards (fal.ai, not the
originally-audited Kie provider); #13 Skills Catalog → reversed from "stay
hidden" to surfacing the user-safe groups (Productivity, Creative, Research,
Media) inside the composer tray, dev-only skills stay hidden.

**Explicitly skipped for R11:** #1 Web Search, #2 Task Tracking,
#11 Scheduled Tasks, #12 TTS, #15 Connected Apps (already live or tracked
elsewhere), #16 Apple/macOS, #19 Media, #20 Obsidian, #21 MLOps, #22 Smart
Home, #23 Social, #24 Email, #25 GitHub, #27 Data Science, #28-32 dev-only
tooling. Not building these in R11; revisit later if a real user need shows
up.

**#26 Creative** (ASCII art/sketching/diagrams) — resolved 2026-07-04:
**skip for R11**, confirmed by SwegOn.

## R11.2 — Composer "+" Tray Redesign [x]

**Build order confirmed 2026-07-04**: R11.2 (this track) ships **before**
R11.1 Settings redesign.

Desktop mockup (Aio's real tokens/fonts, Artifact tool):
`https://claude.ai/code/artifact/47105472-a0b8-4d6e-9ae8-a0857803307c`

Locked layout, after two revision rounds:

- [x] Tray becomes a card-grid popover anchored to the composer's "+" button
      (replaces the flat `.composer-plus-menu` list in
      `apps/web/src/app/(app)/app/mockup.css` lines ~1315-1354), full width
      of the chat input box (not a fixed 460px popover), 2-column card grid
      inside, taller/bigger cards (icon badges up from 32px → 46px).
- [x] **Attach** section: 1 wide card — "Photos & files" (upload + drag &
      drop).
- [x] **Create** section: 3 cards, no provider/model names visible on any
      card (no "fal.ai", no "gpt-image", no model IDs shown to the user):
  - Image — text-to-image. Backend: fal.ai `openai/gpt-image-2`
    (`https://fal.ai/models/openai/gpt-image-2/api`).
  - Edit image — tagged "New". Backend: fal.ai `openai/gpt-image-2/edit`
    (`https://fal.ai/models/openai/gpt-image-2/edit/api`).
  - Video — spans full width (3rd card in a 2-col grid). Backend: fal.ai
    `bytedance/seedance-2.0` **image-to-video**
    (`https://fal.ai/models/bytedance/seedance-2.0/image-to-video/api`) —
    note this is image-to-video, not text-to-video; UI must collect a
    source image, not just a prompt.
  - **Music card removed** — dropped per SwegOn, not in scope.
- [x] **Build & work** section: 2 cards — Website (live preview in Aio
      Terminal), Google Workspace (Slides/Sheets, one entry point, per
      earlier bundling decision).
- [x] **Excluded from this tray** (explicit, not oversights):
  - Voice — hidden entirely for now ("tạm bỏ và ẩn đi").
  - Recurring task shortcut — stays a separate feature, not merged into the
    "+" tray ("để riêng đi").
  - Wide Research / Connect Computer / Playbook — dropped in an earlier
    grill round.
  - Skills Catalog — hidden in an earlier grill round.
- [x] **"+" button implementation**: use Aio's existing shadcn-style
      `Button` component (`apps/web/src/components/ui/button.tsx` +
      `button-variants.ts` — already has `variant="outline"` and
      `size="icon"`), rendered as
      `<Button variant="outline" size="icon" className="rounded-full"><Plus size={16} /></Button>`.
      No new dependency needed — the component already exists and already
      supports this exact variant/size combo.

## R11.3 — Terminal/Workspace Panel Polish (addendum) [x]

Diagnosis: the panel is structurally solid already — Code Execution and
Build-Website output already flow into it via `RunTimeline` (Activity tab)
and `PreviewPane`/`LiveAppPreview` (Preview tab,
`apps/web/src/components/app/FilePreview.tsx`). The "mờ nhạt" complaint is
about presentation, not missing functionality:

- [x] `ToolCallCard.tsx` shows raw `event.toolName` and a JSON-stringify
      preview truncated to 300 chars — replace with friendly per-tool
      icons/labels (mirroring the `task.codeexec` special case already
      handled in `RunEventItem.tsx`'s `genericEventMeta`). Done by the
      parallel R11.3 tool-manifest track (`TOOL_ICON` map +
      `toolDisplayMeta()` in `ToolCallCard.tsx`); read-verified only, not
      re-implemented here to avoid conflicting edits.
- [ ] No live stdout streaming while code execution is in progress — only a
      final truncated preview. Explicitly out of scope for this pass per
      brief — left unattempted.
- [x] `LiveAppPreview`'s iframe has no "open in new tab" affordance for the
      live dev-server preview URL. Done by the parallel track
      (`.terminal-preview-open-btn` + `ExternalLink` button in
      `FilePreview.tsx`); read-verified only, not re-implemented here.

### Terminal UI redesign brief (from screenshot + 2026-07-04 grill round)

SwegOn shared a screenshot of the Aio Output panel showing a `snippet.html`
code-file-card with visibly cut-off/overflowing code lines, a horizontal
scrollbar, and a large empty black area below the card (fixed height cap
despite available vertical space). Grounded in
`apps/web/src/app/(app)/app/mockup.css`:

- [x] **Fix code-block overflow** — `.workspace-code-block` currently uses
      `white-space: pre` (no wrap) + `overflow: auto` (horizontal scroll).
      Change to wrap long lines (`white-space: pre-wrap` or equivalent) —
      code must never render outside the visible card area, no horizontal
      scrollbar allowed. Line-wrap is acceptable; overflow is not. Confirmed
      `white-space: pre-wrap` already in place in `05-right-panel.css`
      (`.workspace-code-block`); no horizontal-scroll rule remains.
- [x] **Remove fixed code-block height cap** — `.code-file-card
      .workspace-code-block { max-height: 360px; }` — this is the cause of
      the empty space below short code blocks and the cramped feel on long
      ones. Let the block use available vertical space instead. Confirmed:
      `.code-file-card .workspace-code-block` now only resets
      `border`/`border-radius`/`margin`, no `max-height`.
- [x] **Remove hard-coded panel width, add free drag-resize** —
      `.right-panel` currently has fixed widths per mode
      (`output-compact: 420px`, `output-focus: min(52vw, 720px)`), no
      resize handle exists in the CSS today. Replace with a draggable
      resize handle so the user can freely widen/narrow the panel instead
      of it being locked to preset breakpoints. Implemented: `rightPanelWidth`
      state + `handleRightPanelResizeStart` pointer-drag handler in
      `AppHome.tsx`, applied as an inline `style` on `.right-panel`; a thin
      `.right-panel-resize-handle` strip (col-resize cursor) added in
      `05-right-panel.css`. Handle renders correctly (screenshot-verified);
      the drag interaction itself was not simulated via Playwright mouse
      events, only code-reviewed.
- [x] **Make the panel taller** — current panel height feels short per
      SwegOn ("hiện tại có chút xíu vậy"); use more of the available
      vertical viewport. The panel's outer height was already correct
      (`.app-container` is a `height:100vh` flex row with default
      `align-items:stretch`); the actual complaint was inner content caps —
      bumped `.terminal-preview-iframe` and `.terminal-preview-doc/.sheet/
      .markdown` from `60vh`→`76vh`, and `.current-run-timeline` from
      `280px`→`50vh` in `05-right-panel.css`.
- [x] **Remove solid background layers from side surfaces — confirmed
      app-wide, 2026-07-04**. `.aio-terminal`
      (`background: var(--surface-secondary-opaque)`), `.sidebar`
      (`background: var(--bg-secondary)`), and `.right-panel`
      (`background: var(--surface-primary-opaque)`) each paint their own
      opaque background on top of the existing global dot-grid
      (`.particles-bg .dot-grid`). Target design: **one single background**
      (the existing dot-grid) visible everywhere in the app, not just the
      Terminal — sidebar, terminal, and right panel all lose their solid
      fills; content renders as individual cards/card-clusters floating on
      the dot-grid instead. Done: `.aio-terminal` and `.right-panel`
      backgrounds set to `transparent` in `05-right-panel.css`; `.sidebar`/
      `.icon-rail-slot` were already `transparent` (only `.icon-rail` itself
      still had an opaque fill, fixed below).
- [x] **Sidebar becomes a snug "card tab", not a full-height background
      panel** — SwegOn's specific ask (screenshot of the left icon rail):
      today `.sidebar`/`.icon-rail-slot` is a full-height 76px-wide column
      with its own background (`apps/web/src/app/(app)/app/mockup.css:187`,
      `:207-227`). Replace with a compact card/pill that wraps snugly around
      just the icon buttons (not full viewport height, not full-bleed
      background) sitting on top of the dot-grid, keeping the existing
      hover-to-expand behavior (`.icon-rail:hover` already widens 76px→348px
      and reveals `.icon-rail-label` text — reuse this interaction, just
      change the container from a full background slab to a bounded card).
      Done in `02-sidebar-icon-rail.css`: `.icon-rail` changed from
      `position: absolute; inset: 0` (full-slot height) to
      `top: 50%; transform: translateY(-50%)` (content-sized, vertically
      centered), with `border-radius`/`box-shadow` added so it reads as a
      floating card, not a column. Screenshot-verified at desktop + mobile.
- [x] **Remove the top bar entirely** — `.top-bar`
      (`AppHome.tsx:2653-2690`) currently holds the sidebar toggle button,
      the Aio icon+name (`current-agent`, `AppHome.tsx:2663-2670`), a
      compression badge, the credit balance badge, and the right-panel
      toggle. SwegOn confirmed 2026-07-04: drop the whole top bar, not just
      the Aio logo inside it. **Resolved 2026-07-04**: `compression-badge`
      ("Compressing context…") is dropped entirely, no replacement. The
      credit balance badge is **not** dropped — it becomes its own floating
      chip/button, positioned so it stays easily visible (exact placement is
      an implementation call, not a further decision gate). Done: `.top-bar`
      block removed from `AppHome.tsx`; credit badge now renders as a plain
      flex child inside `.floating-actions--right` (see next item).
- [x] **Sidebar/right-panel toggle buttons become floating round buttons** —
      today `.toggle-btn` lives inside `.top-bar` (sidebar toggle) and
      `.top-bar-actions` (right-panel toggle). Both become independent
      floating circular buttons (not part of any bar), consistent with the
      "no extra bar/background" direction above. Done: both toggles (plus
      the credit chip) grouped into two fixed flex rows —
      `.floating-actions--left` (sidebar toggle) and
      `.floating-actions--right` (credit chip + panel toggle) in
      `03-main-chat.css`/`AppHome.tsx` — a single flex group per side instead
      of independently-guessed fixed offsets, so the credit chip's variable
      width never collides with its neighbor. Added `padding-top: 54px` to
      `.right-panel` so its own in-panel header (title + Output toggle)
      clears the fixed chrome above it — caught via live screenshot, fixed,
      re-verified.
- [x] **Two-layer design principle, confirmed 2026-07-04 (app-wide, not
      Terminal-specific)** — SwegOn's own framing: **Layer 1** is the single
      global dot-grid background; **Layer 2** is everything else (cards,
      tabs, the chat window frame, chat bubbles, the sidebar card/pill, the
      right panel, etc). No element gets a background layer of its own
      outside these two — this supersedes the earlier "remove solid
      background layers" bullet above and is the general rule any future
      surface should follow, not just `.sidebar`/`.aio-terminal`/
      `.right-panel`.
- [x] **Turn-display comparison** — current chat splits output into
      "Turn 1", "Turn 2", etc. sections in the Activity tab. SwegOn wants
      this compared against how other agent products (Manus, OpenManus, and
      any other open-source repo with a similar code-viewing pane) structure
      turn/output display, and adjusted to match if a better pattern exists.
      This folds into the R11.4 research pass below rather than being
      designed blind.

## R11.4 — Terminal Architecture Research (build vs. borrow) [x]

SwegOn wants a research pass on how other agent products structure their
"terminal"/workspace surface, before deciding whether Aio's Terminal panel
(`RunTimeline`/`PreviewPane`, see R11.3) keeps evolving in place or adopts
patterns/code from elsewhere:

- [x] Study Manus's terminal/workspace UX (behavior, not just the visuals
      already captured as a composer-tray reference in R11.2).
- [x] Read OpenManus source — is there code structure/patterns that can be
      copied into Aio's Terminal, not just referenced?
- [x] Same pass for Onyx and DeerFlow — study their agent-workspace/terminal
      code structure.
- [x] Output: a copy/adapt-vs-build-custom recommendation per project, with
      reasoning, before R11.3 polish work goes beyond the three items
      already listed there.

## Status-line shimmer (from Discord attachment, not yet scoped as a numbered
item above — folds into R11.2 UI polish)

**Update 2026-07-04**: this status line is now also the merge target for
**#8 Task Delegation** above — when Aio delegates to a sub-agent, that state
shows here (plus an Aio mascot image), not as a separate graphic.

SwegOn shared a `TextShimmer` reference component (framer-motion,
gradient-sweep text effect) for Aio's "processing" status line.
`framer-motion` is **not** currently a dependency of `apps/web`
(`class-variance-authority` is, `framer-motion` is not — checked
`package.json` 2026-07-04). **Resolved 2026-07-04**: SwegOn confirmed —
reproduce the shimmer with a pure-CSS `background-position` keyframe
animation, no framer-motion dependency added.

## Evidence Log (R11.1–R11.4)

- 2026-07-04: R11.2 implemented and verified. Changed
  `apps/web/src/app/(app)/app/mockup/04-input-area.css` (`.composer-plus-menu`
  → `.composer-tray*` system: 2-col grid via
  `repeat(2, minmax(0, 1fr))` + `min-width: 0` on cards, 46px icon badges,
  wide-card variant, title/tag truncation) and `AppHome.tsx` (`+` button now
  shadcn `Button variant="outline" size="icon" className="rounded-full"`;
  6-card tray — Attach: Photos & files; Create: Image, Edit image ["New"],
  Video [wide]; Build & work: Website, Google Workspace; icons `Video`,
  `Globe`, `LayoutGrid` added, unused `Mic` removed). Only the Image card is
  wired (`activateImageComposer()`); the other 5 render disabled with
  "Soon"/"New" tags — no backend exists yet for Attach/Edit
  image/Video/Website/Google Workspace. Verified: `tsc --noEmit` clean,
  `eslint` clean (pre-existing warnings only), Playwright screenshots at
  1280×900 and 390×844 confirm no overflow/clipping (a grid `1fr 1fr` overflow
  bug found and fixed on mobile during this pass — grid tracks don't shrink
  below content min-width by default; needed `minmax(0, 1fr)` +
  `min-width: 0`), and a live click-through confirmed the Image card still
  triggers image generation with no regression. Next: R11.1 Settings
  redesign (next item in the confirmed R11 build order).
- 2026-07-04: composer-tray desktop mockup revised (full chat-width tray,
  bigger cards, no provider tags, Music card removed, "+" button restyled to
  match the existing shadcn `Button` outline/icon spec) and republished to
  the same Artifact URL. Confirmed via `grep`/`find` that
  `apps/web/src/components/ui/button.tsx` already exists with the needed
  variant/size combo, and that `framer-motion` is not yet an `apps/web`
  dependency.
- 2026-07-04: recovered the full 32-item Hermes capability audit from the raw
  Discord session transcript (it was never actually lost — a mid-session
  compaction had compressed it down to just a count in my working context,
  and I flagged rather than guessed at the specifics). Replaced the R11.1
  placeholder with the real itemized list.
- 2026-07-04: SwegOn re-stated their original per-item picks on the 32-item
  audit (their first reply right after seeing the raw list, before later
  refinement rounds). Retired the raw list, replaced with resolved
  decisions + new build items (#3, #4, #5, #6, #8, #14, #17, #18) and an
  explicit skip list; added R11.4 (Terminal architecture research: Manus,
  OpenManus, Onyx, DeerFlow — build vs. borrow). One open flag: whether #26
  Creative is still in scope.
- 2026-07-04: second grill round resolved. Locked: avatar display-only,
  #26 Creative skipped, MCP sidebar read-only, R11.2 ships before R11.1,
  #8 Task Delegation merges into the status-line (with an Aio mascot image)
  instead of a separate graphic, #4/#5 opened to all pricing tiers pending
  a credit/quota design. **Major correction**: R11.1's "Custom
  Instructions" item was redundant — `SavedAgents.instructionsAddition`
  already ships this exact feature end-to-end (schema, CRUD, orchestrator
  wiring at `run-orchestrator.ts:224`, and a working textarea UI in
  `SavedAgentsPanel.tsx` mounted inside `SettingsModal.tsx`). Added a large
  Terminal UI redesign brief to R11.3 grounded in a SwegOn screenshot +
  `mockup.css` (overflow/wrap fix, remove fixed height cap, drag-resize
  instead of fixed panel width, taller panel, remove `.sidebar`/
  `.aio-terminal`/`.right-panel` solid backgrounds in favor of the single
  existing dot-grid background, turn-display comparison folded into R11.4).
  Still open (next grill round): agency-agents repo integration into
  SavedAgents presets, credit/quota mechanism design, single-background
  scope (Terminal-only vs. global), and #18 Research merge-vs-separate
  (explicitly deferred by SwegOn pending more research, not blocking).
- 2026-07-04: third grill round resolved. agency-agents repo confirmed
  internal build-tooling only, no SavedAgents integration. Credit/quota
  mechanism direction resolved: extend spend-cap (migration `0022`) with a
  per-tool sub-limit, not per-tier run-counts (code not yet read). Single
  dot-grid background confirmed **app-wide**, not Terminal-only. New from a
  second SwegOn screenshot (left icon rail): sidebar should become a snug
  card/pill wrapping just the icon buttons instead of a full-height
  background column (keep existing hover-to-expand behavior); `.top-bar`
  removed entirely (not just the Aio logo inside it); sidebar/right-panel
  toggle buttons become independent floating round buttons. Open follow-up:
  where the credit badge/compression badge/right-panel toggle relocate to
  once the top bar is gone — asking next round. Confirming this
  understanding back to SwegOn before treating it as fully locked.
- 2026-07-04: SwegOn confirmed the sidebar/topbar redesign understanding
  restated above, plus resolved the one open follow-up: compression badge
  dropped entirely, credit badge becomes its own floating chip/button
  (placement is an implementation detail). SwegOn also generalized the
  background rule beyond Terminal/sidebar/right-panel into an explicit
  **two-layer design principle** for the whole app: Layer 1 = single
  dot-grid background, Layer 2 = all cards/tabs/chat window/bubbles — no
  third layer anywhere. Only remaining open decision gate found by
  re-auditing the file for "pending"/"not yet confirmed" markers: the
  status-line shimmer implementation choice (pure-CSS vs framer-motion,
  see "Status-line shimmer" section) — not yet confirmed by SwegOn.
- 2026-07-04: SwegOn confirmed pure-CSS shimmer (no framer-motion). This was
  the last open decision gate in the file — **R11 plan is now fully locked**
  across R11.1 (Settings), R11.2 (Composer tray), R11.3 (Terminal polish +
  redesign brief + two-layer background principle), and R11.4 (Terminal
  architecture research, scoped but not yet executed). Remaining
  not-yet-started work is execution, not decisions: R11.4's Manus/OpenManus/
  Onyx/DeerFlow research pass (must go through a subagent/fork per
  `CLAUDE.md`), and reading the `0022` spend-cap code to scope the #4/#5
  per-tool credit sub-limit. #18 Research stays explicitly deferred by
  SwegOn's own words, not blocking build order.
- 2026-07-04: R11.4 terminal architecture research complete (subagent, no
  product code touched). Manus researched via web (closed-source); OpenManus,
  Onyx, and DeerFlow cloned depth-1/sparse into scratchpad, source read, then
  discarded. Findings: OpenManus has no frontend at all (nothing to
  copy/adapt); DeerFlow and Onyx both converge on the same pattern — one
  collapsible aggregate-summary header per turn, most-recent step expanded,
  rest collapsed behind a toggle, no numbered "Turn N" labels anywhere in any
  of the three. Aio's own codebase also has no literal "Turn N" labeling
  today. Recommendation: keep evolving `RunTimeline`/`ToolCallCard` in place
  (no code to vendor from any of the three), adopt the collapse-by-default
  aggregate-header pattern plus short present-tense tool labels (Manus) and
  lazy step backfill on expand (DeerFlow's `SubtaskCard`). Full writeup at
  `docs/roadmap/R11_TERMINAL_ARCHITECTURE_RESEARCH.md`.
- 2026-07-04: R11.1 Settings Redesign code-complete + statically verified.
  Four items shipped (Custom Instructions was already done — confirmed again):
  - **Account/Profile tab** (display-only): `apps/web/src/app/(app)/app/page.tsx`
    now reads `full_name`/`name` + `avatar_url`/`picture` from Supabase
    `user.user_metadata` and passes them through `AppHome` to `SettingsModal`
    (new optional `userName`/`userAvatarUrl` props; `email` promoted to a
    SettingsModal prop). Avatar = `<img>` when present, else a capital-initial
    fallback. No upload flow (locked scope).
  - **Notifications tab**: new self-contained
    `apps/web/src/components/app/NotificationPreferencesPanel.tsx` reading/
    writing the master `notifyDiscordGlobal` flag via `GET/PATCH /api/preferences`.
    Per-schedule Discord toggles stay in Scheduled Tasks; copy explains the
    master/per-schedule relationship.
  - **Memory tab** (shell + manual CRUD per owner decision; auto-learn write-
    path deferred): new self-contained
    `apps/web/src/components/app/MemoryFactsPanel.tsx` (add/edit/delete/list)
    over `GET/POST /api/user-memory` + `PATCH/DELETE /api/user-memory/[id]`.
  - **Data-use opt-out toggle**: inline self-contained `DataTrainingOptOutToggle`
    in `SettingsModal.tsx` (Data & Privacy tab), reads/writes `dataTrainingOptOut`
    via the same `/api/preferences` row.
  New backend (mirrored off `notification-repository.ts` + `/api/notifications`
  + migration `0026`; customer resolution via `resolveRunApiContext`):
  migration `0028_aio_user_preferences.sql` (`aio_user_preferences`,
  `notify_discord_global` + `data_training_opt_out`, RLS owner-only, updated_at
  trigger), `preference-repository.ts`, `/api/preferences/route.ts`; and
  migration `0029_aio_user_memory_facts.sql` (`aio_user_memory_facts`,
  label/value/source, RLS owner-only, `(customer_id, created_at desc)` index),
  `memory-fact-repository.ts` (label≤80/value≤500 validation), `/api/user-memory/route.ts` + `[id]/route.ts`.
  Verified: `tsc --noEmit` clean, `eslint` 0 errors (only pre-existing unused-
  import warnings), `npm test` 258/258. Three new tabs wired into the existing
  `SETTINGS_TABS` array + render-branch pattern (Account/Memory/Notifications);
  no new CSS (reused `.mcp-server-item`/`.setting-desc`/`.panel-section-title`/
  `.mcp-add-btn`/`.message-input`). Items marked `[~]` not `[x]` because live
  browser verification is blocked: migrations `0026`-`0029` are local-only
  (confirmed via `supabase migration list --linked` — no `remote` entry), and
  the dev app talks to the linked remote Supabase, so `/api/preferences` and
  `/api/user-memory` will 500 on missing tables until the owner pushes the
  migration bundle (shared-DB change → explicit approval, same blocker as R10.2
  `0026`/`0027`). The Account tab is backend-independent and live-testable now.
- 2026-07-04: R11.3 Terminal/Workspace panel polish implemented, code-verified
  + live browser-verified on `feat/r11-settings` (no new worktree, existing
  WIP preserved). Two items (ToolCallCard friendly labels, LiveAppPreview
  "open in new tab") were already done by a parallel track mid-session
  (`ToolCallCard.tsx`'s `TOOL_ICON`/`toolDisplayMeta`, `FilePreview.tsx`'s
  `.terminal-preview-open-btn`) — read-verified, not re-touched to avoid
  conflicting edits. Code-block overflow/height-cap fixes were also already
  in place (`white-space: pre-wrap`, no `max-height: 360px`). Implemented
  this pass:
  - **Resize handle**: `rightPanelWidth` state + `handleRightPanelResizeStart`
    pointer-drag handler in `AppHome.tsx`, applied as inline `style` on
    `.right-panel`; `.right-panel-resize-handle` strip added in
    `05-right-panel.css`.
  - **Taller panel**: bumped inner content caps (`.terminal-preview-iframe`
    60vh→76vh, `.terminal-preview-doc/.sheet/.markdown` 60vh→76vh,
    `.current-run-timeline` 280px→50vh) in `05-right-panel.css` — the
    panel's outer height was already `100vh`-stretched via `.app-container`.
  - **Two-layer backgrounds**: `.aio-terminal` and `.right-panel` backgrounds
    set to `transparent` in `05-right-panel.css` (`.sidebar`/`.icon-rail-slot`
    were already transparent).
  - **Snug sidebar/icon-rail card**: `.icon-rail` in `02-sidebar-icon-rail.css`
    changed from `position: absolute; inset: 0` (full-slot-height slab) to
    `top: 50%; transform: translateY(-50%)` (content-sized, vertically
    centered), plus `border-radius`/`box-shadow`, keeping the existing
    76px→348px hover-expand behavior. Caught and fixed an `align-items`
    icon-clipping bug (`center` would crop the left-anchored icon glyphs in
    the collapsed 76px state) before ever running the dev server.
  - **Top bar removed**: the whole `.top-bar` block deleted from
    `AppHome.tsx` (`current-agent` logo/name, compression badge dropped
    entirely, credit badge, both toggles). Sidebar-toggle and right-panel-
    toggle are now independent floating buttons; the credit chip floats too.
  - **Floating chrome collision fix**: initially placed the sidebar-toggle
    and (credit-chip + right-panel-toggle) at independently-guessed fixed
    offsets — live screenshots caught two overlap bugs: (1) sidebar-toggle
    over the sidebar's own logo, (2) credit chip's variable-width text
    bleeding into the right-panel-toggle button, which then visually
    collided with the right-panel's own in-panel header ("Output" toggle).
    Fixed by grouping each side into one fixed flex row
    (`.floating-actions--left`/`--right`, `flex-shrink: 0` on children) in
    `03-main-chat.css`/`AppHome.tsx`, plus `padding-top: 54px` on
    `.right-panel` so its header clears the fixed chrome above it. Re-verified
    via Playwright `getBoundingClientRect()` (no overlapping rects) and a
    zoomed-in screenshot crop.
  - Mobile: added `.floating-actions--left { top: 64px; left: 14px; }` at
    `max-width: 768px` in `08-responsive.css` so the sidebar-toggle group
    stacks below `.icon-rail-mobile-toggle` (which owns the 14/14/40px
    corner on mobile) instead of overlapping it; `border: none` added to
    `.icon-rail-mobile-sheet .icon-rail` so the new card border/shadow
    doesn't bleed into the full-height mobile nav sheet.
  Left unchecked (deliberate): live stdout streaming during code execution —
  explicitly out of scope for this pass per brief, not attempted. Verified:
  `tsc --noEmit` clean (only the pre-existing, out-of-scope
  `spend-cap.ts:109` error, confirmed unrelated); `npm test` 261/261 passing;
  Playwright screenshots at 1280x900 and 390x844 against the already-running
  dev server (port 3000, shared with a parallel track) — confirmed clean
  floating chrome (no overlaps after the fixes above), snug hover-expand icon
  rail, transparent terminal/right-panel/sidebar backgrounds showing the
  dot-grid through, and a working empty state on the "Aio Output"/Activity
  tab ("No activity yet"). Not verified live: the actual code-file-card
  overflow scenario from the original bug report (would require triggering a
  real code-execution run through the chat/LLM backend) — confirmed instead
  via direct CSS read (`white-space: pre-wrap`, no `max-height` cap) rather
  than a live repro; the resize handle's drag interaction (rendered and
  code-reviewed, not drag-tested via simulated pointer events). `npx
  playwright test e2e/quick-suggestions.spec.ts` could not run: Next.js
  refuses a second dev-server instance in the same project directory even on
  a different port, and a parallel track's dev server (PID 97923) already
  owned this directory — killing it was avoided to not disrupt that track;
  unit tests + live manual Playwright screenshots covered verification
  instead. Files touched: `apps/web/src/components/app/AppHome.tsx`,
  `apps/web/src/app/(app)/app/mockup/02-sidebar-icon-rail.css`,
  `03-main-chat.css`, `05-right-panel.css`, `08-responsive.css`. No files
  under `apps/web/src/lib/aio/billing/` or `apps/web/src/lib/aio/tools/`
  touched; `ToolCallCard.tsx`/`tool-manifest.ts`/`FilePreview.tsx` read-only.
- 2026-07-04: #4/#5 spend-cap sub-limit fixes (direct, no subagent) + a
  second R11.3 track (delegation-merge status line, MCP sidebar) + a final
  Terminal-panel-redesign track, all reconciled and verified together.
  **Spend-cap**: fixed a real `tsc` TS2345 bug in `getToolSpendUsd`
  (supabase-js `.in()` was passed a `PostgrestFilterBuilder` instead of a
  plain array — restructured to a two-step query) and a missed
  `tool-manifest.ts` gap (`browser`'s `planAvailability` was still
  `["pro","business"]`, not `ALL_PLANS` — #5 says all tiers); updated the
  now-stale `tool-policy.test.ts` assertion to match. `checkToolSubLimit`
  left correctly implemented but honestly documented as **unwired** — no
  per-tool-call interception point exists in apps/web (Hermes owns tool
  execution); wiring it needs a design call (Hermes-side hook vs. Next.js
  pre-run coarse check), not made this session.
  **Delegation-merge + MCP sidebar** (2nd R11.3 track): #8 done via a
  `/delegat/i` heuristic on `runningTool.tool` reusing the existing
  `agent-info-avatar` mascot icon (no new graphic); #14 done via the real
  `GET /api/integrations/mcp` route + existing `.mcp-server-item` CSS,
  labeled "Integrations", `transport` field omitted from display.
  **Terminal panel redesign** (largest track, ran longest): all 9 R11.3
  scope items + #8 + #14 confirmed done. Caught and fixed two real bugs
  during its own verification: (1) `.right-panel`'s blanket
  `transition: var(--transition-slow)` was catching the new inline
  drag-resize width, making the panel lag ~9x behind the pointer (measured
  120px drag → only +14px movement) — fixed by suspending `transition` on
  the panel only while a drag is active, re-verified 1:1 tracking; (2) the
  two-layer background principle's `.sidebar → transparent` change had
  bled into the mobile full-screen sidebar overlay
  (`08-responsive.css` `@media (max-width:768px)`), making the primary
  mobile nav overlay nearly illegible — fixed with a scoped
  `background: var(--surface-primary-opaque)` inside that breakpoint only,
  desktop `.sidebar` untouched.
  **Combined verification** (all three tracks together, this pass):
  `tsc --noEmit` clean, `eslint` on touched files 0 errors (only
  pre-existing unused-var warnings), `npm test` 261/261 after the
  `tool-policy.test.ts` fix (was 260/261 — the one failure was the stale
  browser-tier assertion above, not a regression). **Update 2026-07-04
  (later pass)**: migrations `0028`-`0030` pushed to the linked remote
  Supabase; `checkToolSubLimit` wired at `POST /api/chat/approval`; #6
  Vision built (wire contract + composer UI). R11 is now code-complete
  and statically verified across all four tracks (R11.1, R11.2, R11.3,
  R11.4), plus #3-#6, #8, #14, #17. **Update 2026-07-04 (Playwright
  pass)**: live browser verification done via `apps/web/e2e/
  r11-settings-and-vision.spec.ts` (6/6 passing) — R11.1 Settings modal
  (Notifications toggle → `PATCH /api/preferences`, Memory tab fact
  create → `POST /api/user-memory`, Account tab read-only display) and
  #6 Vision composer (attach → thumbnail chip → sent with correct wire
  payload, 8MB guardrail, 4-image cap) are now live-verified, not just
  statically checked. Full e2e suite (20/20) green after fixing an
  unrelated pre-existing selector drift in `app-smoke.spec.ts` (R11.2
  tray renamed "Create image" → "Image"). Still open, none blocking:
  #18 Research (owner deferred, needs more research before next grill
  round); drag-drop/paste attach paths not separately exercised (share
  the same code path as the verified file-picker path).

## R11.5a — UI polish quick wins (done 2026-07-05)

11 CSS/token/copy fixes from the post-launch audit (full list and severity
tags still in `R11_EXECUTION_CHECKLIST.md` under R11.5a). All implemented,
`tsc`/`eslint` clean, dev server serving `/app` with no compile errors.

What changed: fixed a broken status-dot animation (duplicate animation
name silently killed it), added a proper light-text color for the 5 accent
themes that had unreadable white-on-color buttons, unified 3 different
reds into one consistent error color, made the Deep Research card follow
the user's chosen accent color instead of ignoring it, added
reduced-motion support to background/cursor animations, fixed code syntax
highlighting in light theme, fixed the greeting/avatar to show the user's
real name and photo instead of a placeholder, removed a fake "Pro Plan"
label that wasn't wired to anything real, renamed internal vendor names
(OpenRouter, Kie.ai, etc.) to plain capability labels in Settings, gave the
delete button in Scheduled Tasks a visibly different color before it's
armed, and de-duplicated repeated delete-button styling in Settings into
one shared style.

**Still needs a human look** (not verifiable by the automated checks that
ran): open the app and eyeball — all 7 color themes in both light/dark for
readable button text, light-mode code blocks, that reduced-motion actually
calms the animations, and that a real Google-linked account shows its
actual name/photo. Nothing here is expected to look broken, this is a
sanity pass, not a "go find bugs" ask.
</content>
