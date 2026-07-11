# R15 Execution Checklist — Plan/Research Rebuild + Streaming + Panel Cleanup

**Status:** in progress (2026-07-10). Branch `r15-plan-research-rebuild` from
`main` (`5961baa`). Scope locked by owner 2026-07-10. Zero deer-flow
contamination — this phase touches `apps/web` + `apps/harness` of this repo only.

## Goal

Four workstreams, one branch, shipped incrementally with a live verify loop each:

- **A. Streaming jitter fix** — chat token stream became choppy; restore smooth render.
- **B. Remove "Current Run" + "Today" cards** — panel cards (not tabs), felt redundant.
- **C. Plan + Research mode rebuild** — multi-question grill (Next/Back), one summary
  message, HITL approval gate, then run. Unified UX for both modes.
- **D. Docs/state sync** — state, README, CLAUDE.md reflect post-R15 reality.

## Decisions (locked 2026-07-10)

1. **Question generation:** batch — backend emits ALL clarifying questions (2-5) in one
   `aio-questions` block. Frontend wizard shows Next/Back, answers editable before submit.
2. **Approval gate:** reuse existing HITL approval infra (`aio_approvals`,
   `/api/chat/approval`). Plan message gets Approve / Edit / Cancel.
3. **Research scope:** same grill + summary + approve flow as plan; after approve, runs
   the research pipeline (web tools, sources, progress).

## Status Key

- `[x]` done + verified (tsc + lint + Playwright live)
- `[~]` in progress / partially done
- `[ ]` not started

---

## B — Remove "Current Run" + "Today" cards  (smallest, do first)

Note: these are **panel cards in RightPanel**, not tabs. Backend `/api/runs/*`,
`run-repository/api/client`, `RunTimeline`, `useRunTimeline` are **shared run
infrastructure** (approvals, events, stop, lifecycle) and MUST stay. Only the
visible cards + their frontend wiring go.

- [x] **B1.** Delete `apps/web/src/components/app/app-home/sections/CurrentRunCard.tsx`
- [x] **B2.** Delete `apps/web/src/components/app/app-home/sections/TodayCard.tsx`
- [x] **B3.** Edit `RightPanel.tsx` — remove `<CurrentRunCard />` + Today section (+ their 15 props)
- [x] **B4.** Edit `MessageList.tsx` — remove mobile today strip
- [x] **B5.** Edit `AppHome.tsx` — remove `handleTodayAction`/`activeTodayCards`/TODAY_CARDS import/currentRun* derived + prop drilling
- [x] **B6.** Edit `app-home-utils.ts` — remove `TODAY_CARDS` constant
- [x] **B7.** Edit `app-home-types.ts` — remove `TodayAction`, `TodayCard` types
- [x] **B8.** `useRunTimeline.ts` left as-is — shared run infra (approvals/events/stop) MUST stay; no CurrentRunCard-only props were found that required dropping (kept RunTimeline for HITL approval surface)
- [x] **B9.** Verify: tsc clean, app-smoke 4/4 green (currentRun DOM assertions removed + obsolete stop-card test deleted)

## A — Streaming jitter fix

Root cause found: the autoscroll `useEffect` (`AppHome.tsx`) fired
`scrollIntoView({behavior:"smooth"})` on **every token** and ignored scroll
position — the smooth animation fought content growth every frame. That is the
"ko mượt như ban đầu" regression. (The full-list re-render / per-message regex
re-parse the audit flagged is pre-existing structural cost, not a regression —
deferred to A-followup below, only if long-conversation lag is observed.)

- [x] **A4.** Autoscroll: sticky-bottom (scroll only if user within 120px of
      bottom — no yanking while reading history) + `behavior:"auto"` (instant,
      no smooth-animation thrash). `AppHome.tsx` autoscroll `useEffect`.
- [x] **A5.** Verify: tsc clean, app-smoke 4/4 green.
- [x] **A-followup.** Real lag was observed (owner report, 2026-07-11), so
      implemented: extracted `MessageRow` from `MessageList.tsx`'s per-message
      `.map()` body, wrapped in `React.memo` with a **custom comparator**
      (not default shallow-equality — `AppHome.tsx`'s handler props
      `handleCopyMessage`/`openWorkspaceEntry`/`openShowcasePanel`/
      `openReportPanel` aren't `useCallback`-wrapped, so default memo would
      never skip; comparator instead ignores function-prop identity and
      compares only what actually affects render — message identity, a few
      primitives, and, only for the currently-streaming row, live
      `timelineEvents`/`activity`/`showcases`/`activeRunId`). Also hoisted
      `firstUserText` (was an O(n) `messages.find()` re-run per message, i.e.
      O(n²) over the list) into one top-level `useMemo`. Added
      `experimental_throttle: 50` to `useChat` in `AppHome.tsx` as a
      belt-and-suspenders batch on top. Verified: tsc clean, 330/330 unit
      tests, no stale-closure regressions (audited every frozen handler for
      closed-over mutable state; only `isMobileViewport` found, comparator
      already guards it).

## C — Plan + Research rebuild  (largest)

Shared flow for both modes: toggle mode → submit → backend emits batch questions →
wizard (Next/Back) → summary message → plan → approve gate → run.

### C.be — Backend protocol

- [x] **C1.** `plan-mode.ts` — replace "ask ONE question per turn" with "emit ALL questions
      (2-5) in one fenced `aio-questions` block: `{questions:[{question,choices[],recommended}]}`"
- [x] **C2.** `research-mode.ts` — same batch-question instruction
- [x] **C3.** `run-orchestrator.ts` — after summary message, keep tools disabled; emit plan;
      wire an approval gate so execution only starts after Approve
- [x] **C4.** Transport: reused existing `aio-question`/`aio_approvals` SSE + approval infra,
      plural `aio-questions` block shape

### C.fe — Frontend wizard + approval

- [x] **C5.** `app-home-utils.ts` — added `parsePlanQuestions` (plural); parses `aio-questions` block
- [x] **C6.** New `PlanWizard.tsx` — step indicator (Q i/N), question card, choices + Other,
      Next/Back, local answer state (editable), Review step
- [x] **C7.** `usePlanFlow.ts` rewrite — collect answers → send ONE summary message → await plan →
      render Approve/Edit/Cancel via approval infra
- [x] **C8.** `Composer.tsx` — wired wizard in place of single-question auto-send
- [x] **C9.** Research mode: reuses wizard; after Approve, run-orchestrator enables research tools
- [x] **C10.** Verify: Playwright live (`e2e/plan-wizard.spec.ts`, 4/4 green) — plan mode: submit
      task → answer 3 Qs via Next/Back → edit one → submit summary → plan appears → Approve →
      run executes. Repeat for research mode. tsc clean.

**Post-implementation UX fixes (product review, applied 2026-07-11):**
- Wizard answers rendered as raw "1. Q\nAnswer: A" text dump in the chat bubble → fixed by
  stamping `metadata.planWizardAnswers` on the summary message and giving `MessageList.tsx` a
  dedicated recap render branch (reuses `.plan-wizard-review*` CSS from `PlanWizard.tsx`'s own
  Review step).
- Approve confirm text corrupted the research card heading / "Stop & edit" prefill / report
  title → root cause was `MessageList.tsx` deriving the research query from the nearest
  *preceding* user message (post-approve, that's the synthetic confirm text) instead of the
  thread's first user message; fixed the derivation. Also fixed `usePlanFlow.ts` sending a
  confirm string that didn't match `research-mode.ts`'s exported `RESEARCH_CONFIRM_TEXT`.
- Edit/Cancel buttons visually indistinguishable (`06-gallery-cards.css`) → `.plan-btn.cancel`
  now ghosted (no border, muted text) with a red-tinted hover, distinct from `.plan-btn.adjust`'s
  neutral bordered look.

- [x] **C11. Approval-gate correctness fix (2026-07-11, 6-agent grill-me round).** Found via
      hermes-architect audit: the sole "final plan ready" test on both call sites
      (`run-orchestrator.ts` server-side approval creation, `usePlanFlow.ts` frontend Approve-button
      gate) was negative-only — "response doesn't contain an `aio-questions` block" — so a
      malformed/refused/off-topic model turn during plan phase could still create a durable
      approval and be executed as if it were a real plan. Fixed by adding
      `isFinalPlanShape()` (`plan-mode.ts`) — a positive shape check requiring ≥2 numbered-step-
      looking lines in addition to the existing negative check — and wiring it into both call
      sites (research mode's frontend gate now checks the already-parsed `researchPlan` instead,
      since its plan artifact is a JSON fence block, not numbered lines; research's backend gate
      was already correct via its `aio-research-plan` fence check). TDD: 4 new unit tests in
      `plan-mode.test.ts` (8/8 total pass), `tsc --noEmit` clean. No e2e spec changes needed
      (logic-only, no rendering change).

## D — Docs / state sync

- [ ] **D1.** `AIO_PROJECT_STATE.md` — add R15 in-progress section; trim if stale
- [ ] **D2.** `README.md` / `CLAUDE.md` — point active checklist at R15 (no current-run/today refs exist today)
- [ ] **D3.** Confirm zero `deer-flow` / `deerflow` references introduced in any R15 change

## Open notes

- C may surface scale (backend protocol change + new wizard + approval wiring ×2 modes).
  Build the lazy correct version first; if C blows up, split into C.fe / C.be sub-commits
  still on this branch. Report rather than silently scope-cut.
- Each workstream commits independently. Verify (tsc + lint + Playwright) before marking done.
- **DeepWiki MCP added (2026-07-11, decision 7b):** project-local `.mcp.json` (`deepwiki`,
  `https://mcp.deepwiki.com/mcp`, streamable HTTP, no auth) targeting the public upstream
  `github.com/NousResearch/hermes-agent` — dev-time coding-agent lookup only, not
  product-facing. Activates on next Claude Code session start / `/mcp` reload.
- **Credit-cap trial (decision 9a) live, set by Claude at owner's explicit request** —
  owner overrode the earlier "owner runs it" plan via Discord ("hãy tự set cap credit
  đi cho tôi dùng thử với tư cách là user"). `AIO_BETA_SPEND_CAP_CREDITS=50` set in
  `apps/web/.env.local`, `aio-app.service` restarted, confirmed serving. Trial is live;
  raise/remove the cap once the owner is done testing it.

## E — Discord UI feedback backlog (2026-07-11, msg 1525193573853561015 — Aio UI, not deer-flow)

11-item Vietnamese feedback list from owner. Items 3/7/10 done earlier same day
(thinking-indicator jump, notifications/knowledge nav removal). Items below are
the remaining backlog closed in this pass.

- [x] **E1. Chat image bubble sizing.** User-sent image attachments were nested
      inside `.message-bubble` (96px cropped thumb, squeezed under text). Moved
      attachments block to a sibling of `.message-bubble` in `MessageList.tsx`
      (right-aligns via existing `.message.user .message-content{align-items:flex-end}`),
      thumb 96px→200px, `04-input-area.css`. Verified: tsc clean, Playwright
      `r11-settings-and-vision.spec.ts -g Vision` 6/6 green (desktop + mobile).
- [x] **E2. Vision bug (priority, real functional bug).** Two-layer wiring gap,
      images never reached the model:
      1. `chat-route-handler.ts` checked AI-SDK part type `"image"`, which
         `convertToModelMessages` never actually emits — real shape is
         `{type:"file", mediaType, data}`. Fixed detection + read `part.data`
         instead of nonexistent `part.image`.
      2. Hermes gateway `_handle_runs` (`apps/harness/.../api_server.py`)
         assumed any array-shaped `input` was `{role,content}` messages and did
         `raw_input[-1].get("content","")`, silently yielding `""` for a
         content-parts array (Aio's actual wire shape) → hard 400 "No user
         message found in input" once (1) was fixed. Added a
         `raw_input_is_message_array` heuristic to disambiguate the two shapes.
      Verified: tsc clean, `python3 -m py_compile` clean, 2 new unit tests
      (`chat-route-handler.test.ts`), Playwright Vision tests 6/6 green.
- [x] **E3. Settings "Model Providers" tab — audit.** Traced
      `credentials.ts`/`api/credentials/route.ts` → Hermes runtime `os.getenv`
      consumption (`cli.py`, `mini_swe_runner.py`, `trajectory_compressor.py`).
      Genuine R11 BYOK infra (per-user OpenRouter/Kie/Daytona/Honcho keys),
      load-bearing. Left unchanged per directive.
- [x] **E4. "Enable Schedule" feature — investigated, not a bug.** Full chain
      already wired: icon-rail `scheduled` entry → `handleRailItemClick` →
      `ScheduledTasksModal` → `useCronJobs` hook → real `/api/cron` CRUD →
      `schedule-repository`. Root cause of "doesn't work" perception:
      `requireCronAccess` gates the `cronjob` toolset to Business plan
      (`pricing.ts`, `locked grill-me 2026-06-20`); dev-bypass sessions get
      `planTier:"pro"`, which excludes `cronjob`, so it always renders the
      locked state in dev. This is an intentional monetization decision from a
      prior grill-me session, not a wiring gap — no code changed.
- [x] **E5. Glass/gradient card material.** Applied the existing
      `--glass-bg/--glass-border/--glass-blur` recipe (already proven on
      `.approval-card`/`.plan-card`) to the remaining unglassed
      cards/bubbles — material only, no skew/layout/dark-bg change, theme-aware
      via existing `[data-theme="light"]` token overrides:
      `.message.ai .message-bubble`, `.message.user .message-bubble`,
      `.research-progress-card` (`03-main-chat.css`), `.composer-tray-card`
      (`04-input-area.css`), `.plan-question-card` (`06-gallery-cards.css`).
      `.message-artifact-card`/`.approval-card`/`.plan-card` already glassed,
      left as-is; `.generated-image-card` is a transparent image wrapper, no
      material to add. Verified: tsc clean, Playwright Vision tests 6/6 green.

Touched outside `apps/web`: `apps/harness/hermes-agent/gateway/platforms/api_server.py`
(E2, root cause genuinely spans both layers). No deer-flow files touched.
No commits made — all changes left staged in the working tree for owner review.

### Follow-up round (2026-07-11, same Discord thread — live UI re-check)

Owner reported E5/icon-rail fixes weren't visibly landing and gave 2 new
screenshots. Self-verified via Playwright (chrome extension not connected
this session) instead of asking owner to re-screenshot.

- [x] **E6. Icon-rail collapsed-state text leak ("lòi chữ").** Root cause:
      label opacity/transform fade-in (`.icon-rail--compact:hover .icon-rail-label`,
      `02-compact-variant.css`) had no delay, so it animated in parallel with
      the rail's 0.2s width-expand (`01-base.css`) — mid-transition frames
      showed clipped glyphs right at the still-narrow edge. Fixed with a
      `0.15s` transition-delay on the label so it only starts fading in once
      the rail has (nearly) finished widening. Verified via Playwright
      screenshots at t=0 (collapsed, clean), t=80ms mid-hover (box already
      wide, labels still invisible), t=full-hover (clean reveal).
- [x] **E7. Icon-rail hover highlight oversized box.** Two stacked causes in
      `02-compact-variant.css`: (1) `.icon-rail-item--compact:hover` set a
      full-row `background`, loaded after and same-specificity as
      `01-base.css`'s intended "highlight only the label text" rule, so it
      won. Removed. (2) `.icon-rail-item--compact .icon-rail-label` had
      `min-width: 132px`, forcing the (now correctly-scoped) label highlight
      pill wider than short words like "Settings". Removed. Verified via
      Playwright: highlight now hugs "Settings" text exactly, single color
      layer, no full-row wash.
- [x] **E8. Terminal panel "Activity" tab → "Code" tab, drop turn-splitting.**
      Owner clarified the panel only has Code/Preview (no Activity), and the
      Code tab should show live-running task code, not a per-turn list of
      copy/download command blocks. `RightPanel.tsx`: renamed tab label
      "Activity"→"Code" (icon `ListTree`→`FileCode`, tab id `"activity"` kept
      internally, no type/context churn). Replaced the `workspaceEntries.map`
      "Turn N" collapsible cards (Copy/Download per block) with the
      `openShowcase`-driven live code view already used elsewhere in this
      file (script path + syntax-highlighted `taskData.code` + error detail),
      kept `RunTimeline` above it for live agent status. Removed now-unused
      props/imports (`workspaceEntries`, `isStreaming`, `lastAssistantMessage`,
      `expandedWorkspaceId` read, `copiedMessageId`, `handleCopyMessage`,
      `handleDownloadCodeBlock`, `ChevronRight`/`Copy`/`ListTree` icons,
      `codeBlockSize`) — prop types unchanged so `AppHome.tsx` call site
      wasn't touched. Verified: tsc clean, `app-smoke.spec.ts` 4/4 green,
      Playwright screenshot confirms tabs read exactly "Code"/"Preview" and
      the empty state ("No code running") renders with no turn segmentation.
- [x] **E9. Icon-rail critique fixes (P0/P1, 2026-07-11 12:10 critique).** P0
      asymmetric hover: only the label got a highlight pill, icon didn't (icon
      color changed via inherited `color` but had no background), read as
      unbalanced. Wrapped icon in `.icon-rail-icon-inner` span, gave it the
      same `color-mix(...8%...)` pill as `.icon-rail-label-inner` on hover
      (`01-base.css`). P1 disabled-nav clutter: 4/9 rail items were permanently
      disabled ("coming soon"), filtered those out of render entirely
      (`IconRail.tsx`, same pattern already used for the removed Notifications
      entry) instead of showing unusable buttons — re-add once a feature ships.
      Dead `:disabled` CSS removed from both `01-base.css` and
      `02-compact-variant.css`. Verified: tsc clean, 330/330 unit tests,
      Playwright `app-smoke`/`plan-wizard` 4/4 green, live hover check confirms
      icon + label now share identical computed background.
      **Found, not caused, during this pass:** `notifications.spec.ts` (2
      tests) already fails on the current uncommitted tree — the Notifications
      icon-rail entry was removed earlier today (item #7) but
      `NotificationsPanel` has no other trigger, so it's now unreachable UI.
      Pre-existing gap from the E1-E8 pass, left untouched (out of this task's
      scope) — flagging for owner/next session.

No commits made — left staged for owner review alongside the earlier E1-E5 batch.

- [x] **E10. Font picker (item #6) + e2e regression batch, closes E9's flagged
      gap.** Two pieces:
      1. Font picker: 5 options (Inter default + 4 alternatives), wired into
        `SettingsModal.tsx` Personalization tab with `localStorage` persistence.
        Previously shipped but undocumented in this checklist.
      2. e2e batch fixing 5 failures (3 stale-test, 2 real regression), root
        caused individually not guessed:
        - Stale tests: `r11-settings-and-vision.spec.ts` still targeted removed
          "Notifications"/"Memory" Settings tabs (consolidated in E9's own
          predecessor pass) — retargeted the Discord-toggle + read-only-identity
          tests to "Account", deleted the Memory-tab test outright (feature has
          a `ponytail:` comment confirming deliberate removal, not a bug).
        - Missing mobile guard: `r11-settings-and-vision.spec.ts`,
          `google-calendar-connect.spec.ts`, `notifications.spec.ts` opened
          Settings/Scheduled dialogs without first clicking the mobile "Open
          nav" hamburger toggle (`FloatingChrome.tsx`), unlike `app-smoke.spec.ts`
          which already had the guard — added the same
          `if (Open nav visible) click it` guard to all affected tests/helpers.
        - **Real regression closing E9's flag:** `IconRail.tsx` had
          `key !== "notifications" &&` unconditionally filtering the
          Notifications rail entry out of render — but `NotificationsPanel` and
          its unread-badge logic were still fully wired with no other trigger,
          silently making it unreachable UI. No `ponytail:` comment justified
          this (unlike Memory), and E9 had explicitly flagged it as "found, not
          caused... flagging for owner/next session." Fixed by removing that
          clause from the filter predicate.
        - Compounding: the unread badge was further gated `isCompact &&`
          (pre-existing, predates this session — confirmed via `git show HEAD`),
          so even reachable it never rendered on the mobile rail variant.
          Removed that clause. Then found `notificationsUnread` was never
          threaded to the mobile `<IconRail>` call at all —
          `FloatingChrome.tsx` didn't declare the prop and `AppHome.tsx` never
          passed it to `<FloatingChrome>`. Wired it through both.
      Verified: tsc clean, 330/330 unit tests, 36/36 Playwright e2e (desktop +
      mobile chromium, full `e2e/` directory). No commits made — left staged
      for owner review alongside the E1-E9 batch.

- [x] **E11. Discord UI punch-list (2026-07-11, msg 1525434824850931722) —
      owner-driven, reverses part of E10.** Owner request via Discord
      screenshot, 8 items, ran through `agent-pipeline` (frontend-builder
      build → kimo critique → frontend-builder fix round → verified):
      1. **Notifications bell removed from icon-rail again** — deliberate
         owner call, overriding E10's "real regression" fix that had just
         restored it. `ICON_RAIL_ITEMS` entry + `Bell` import deleted
         (`app-home-utils.ts`), dead `key === "notifications"` branch removed
         (`AppHome.tsx`), badge-render branch removed (`IconRail.tsx`).
         `NotificationsPanel`/`useNotifications` state left wired but now has
         zero UI entry point — component/backend untouched, just unreachable.
         **Do not re-add on a future e2e-regression pass** — this is the
         current intended state, not a bug.
      2. **Dev-unlock root-caused:** `wip = disabled` ignored `isDev`, so
         dev-unlocked items were clickable but still styled/behaved locked.
         Fixed to `wip = disabled && !isDev` — then kimo found this made real
         no-op items (Agents/Tasks, still `disabled:true` with no click
         handler) look fully live in dev; round-2 fix reverted to
         `wip = disabled` (keep the dimmed/`cursor:default` treatment in dev
         too) and added a `.icon-rail-item--wip:hover` override so hover
         doesn't highlight them either.
      3. **Knowledge tab removed** from `SettingsModal.tsx` (`SETTINGS_TABS`
         + render block + now-unused imports) and from the icon-rail —
         full removal, not dev-gated.
      4. **Analytics removed** from the icon-rail (`BarChart3` import +
         array entry).
      5. **Background glow removed** — `.bottom-glow`/`::before`/`::after` +
         `@keyframes glowPulse` deleted from `01-base.css`, plus its JSX
         trigger in `AppHome.tsx`; also removed a legacy
         `.particles-bg .dot-grid` radial-gradient rule that was bleeding an
         extra gradient behind the real `DotGrid.tsx` canvas.
      6. **Terminal "Code" tab fixed** — was rendering `<RunTimeline>` (the
         step/tool chronology: Write File, Terminal Sandbox, Reasoning
         available, Running/Completed badges) instead of code. Removed that
         render path from the Code tab (`RightPanel.tsx`); `RunTimeline`
         itself stays wired for the separate mobile "Live" modal. Preview tab
         untouched.
      7. **Terminal panel unified into one card** — toggle button had been
         rendering as its own pill outside `.aio-terminal`, and
         `.aio-terminal-tabs` had an opaque background distinct from the
         container, reading as 3 stacked boxes. Toggle now only renders when
         closed; when open, `.aio-terminal-header` is the first child inside
         `.aio-terminal` and closes it on click; tabs background made
         transparent with a `border-bottom` divider.
      8. **Live-verified** (mocked-SSE Playwright, temp spec deleted after):
         Code tab renders plain syntax-highlighted Python source with no
         step/badge strings present (negative-asserted); Preview tab renders
         an actual `iframe`d page (blue background + heading), not an empty
         state. **Caveat:** this repo's e2e harness has no path to a real
         Hermes/sandbox backend (fully mocked `/api/chat` SSE, fake
         Supabase, dev-auth-bypass) — proven correct against realistic mock
         events, not against a live run. Terminal panel still has no
         permanent e2e coverage (temp spec was one-off, deleted per scope).
      **Kimo critique (round 1) found 3 issues, all closed:**
      - Critical: `.aio-terminal-header` used `--accent-secondary` (a fixed
        pastel, not theme-aware) for text color on a near-white light-mode
        surface — contrast as low as 1.40:1 across all 7 accents (fail vs.
        3:1 minimum). Kimo self-fixed: swapped to `--text-secondary`
        (`--text-primary` on hover), matching the old toggle-button's
        resting color.
      - Major: closing Terminal lost all button affordance — flat text, no
        border/background/icon signaling "click to close" (previously a
        solid-accent pill). Fixed: added a small `X` icon
        (`.aio-terminal-header-close`, `lucide-react`) at the header's right
        edge, opacity 0.75 → 1 on hover.
      - Minor (same root cause as the dev-unlock round-2 fix above,
        superseded): dev WIP items indistinguishable from live ones.
      Verified independently this session (not just agent-reported): grepped
      the actual diffs for the close-icon JSX/CSS and the wip-hover override,
      ran `npx tsc --noEmit` clean, `git status` showed no stray temp
      files/specs left behind.
      **Open gap for owner:** Notifications feature (panel + unread state)
      has no UI entry point anywhere now — decide if/where it should
      resurface (e.g. under Settings → Account) or stays fully removed.
      No commits made — left staged for owner review.

- [x] **E12. Light-mode shadow follow-up (2026-07-11, msg 1525475660221382810).**
      E11's `--shadow-sm/md/lg: none` (app-wide, set in an earlier ponytail
      pass) reads fine on dark bg where cards lean on `--border-color`, but
      in light mode `--bg-card`/`--bg-secondary` are both `#ffffff` against a
      near-white `--bg-primary` (`#f5f5fa`) — border alone (`rgba(0,0,0,0.08)`)
      wasn't enough separation, cards/bubbles were hard to see. Scoped fix to
      `.aio-mockup[data-theme="light"]` only (`07-templates-modal.css`):
      added `--shadow-sm`/`--shadow-lg` back as soft shadows
      (`rgba(28,28,46,...)`, tuned to the light palette), dark theme's
      `none` in `01-base.css` untouched. Applies to every existing
      `var(--shadow-sm/lg)` call site (message bubbles, gallery/plan/research
      cards, composer, icon-rail floating pill, mobile drawer) — no new CSS
      rules needed, just re-fed the existing token. Verified: `tsc --noEmit`
      clean; temp Playwright spec (deleted after) set `aio-theme=light` via
      localStorage, asserted computed `box-shadow !== "none"` on the
      composer, and screenshotted the home screen — cards/status panel/
      Terminal header now read with a visible soft shadow. No commits made —
      left staged for owner review alongside E11.
