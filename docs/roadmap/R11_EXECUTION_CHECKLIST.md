# R11 Execution Checklist — Settings Redesign + Composer Tray + Hermes Capability Surfacing

Trigger: owner grill decision, 2026-07-03/04 (Discord, chat_id
`1519020450322317362`), 5 grill-me rounds on `feat/r11-settings`. Scope spans
three tracks that ship independently:

- **R11.1 Settings redesign** — current `SettingsModal.tsx` (7 tabs) called
  "tạm bợ" (half-baked); add tabs that surface real backend gaps instead of a
  cosmetic pass.
- **R11.2 Composer "+" tray redesign** — Manus mobile "Add to conversation"
  card-sheet concept, adapted to a desktop popover anchored to Aio's existing
  `.composer-plus-menu`.
- **R11.3 Terminal/Workspace panel polish** — addendum found while
  investigating why the panel feels "mờ nhạt" (weak) during the R11.2
  discussion; not a rebuild.
- **R11.5 UI/UX polish pass** — post-launch multi-agent audit (sidebar
  redundancy, full-app score, accessibility, product/UX, usability) plus
  `assistant-ui`/`open-webui` reference research; addendum found after
  R11.1-R11.4 shipped, split into quick-win (CSS/token) and component-logic
  tracks.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## R11.1–R11.4 — done, moved to `R11_DONE.md`

All four tracks (Settings redesign, Composer "+" tray, Terminal/Workspace
polish, Terminal architecture research) shipped and verified 2026-07-04.
Full detail + evidence log moved to `docs/roadmap/R11_DONE.md` (2026-07-04
split, to keep this active file lean). Only R11.5 (below) is still open.

## R11.5 — UI/UX Polish Pass (post-launch audit) [ ]

Trigger: after R11.1-R11.4 UI changes went live, SwegOn spotted a leftover
background-gradient artifact (fixed inline — see Evidence Log), then asked
for (1) a sidebar New-Chat/toggle redundancy review, (2) an "agency team"
pass scoring the *entire* `/app` UI across every angle, and (3) a check of
two external reference products (`assistant-ui`, `open-webui`) for
applicable patterns. 5 specialist agents dispatched 2026-07-04, all
complete: **kimo** (sidebar-specific), **kimo** (full-app pass),
**accessibility-auditor**, **product-ux-guardian**, **ux-researcher**.

Scores from the full audit: overall UI/UX 6/10, accessibility 4.5/10
(NEEDS WORK), product/UX consistency & copy 6.5/10, usability/user-journey
6.5/10.

External references: `assistant-ui` — recommend not adopting, pattern
reference only (see prior research, not filed separately). `open-webui`
(144k★) — no code/pattern adoption for this pass; PWA, dedicated Notes
workspace, persistent cross-conversation memory, RBAC, and `#`-command
integration noted as possible future backlog, out of scope here.

Split by blast radius per `CLAUDE.md` Coding Guardrails (surgical changes,
no speculative refactor):

### R11.5a — Quick wins (tokens/CSS/copy only, no component logic) [x]

Done 2026-07-05, all 11 items. Full list + evidence moved to
`docs/roadmap/R11_DONE.md` (kept lean here since nothing is left to act on
except the human visual check noted there).

### R11.5b — Component/logic changes (needs real implementation + review) [~]

- [x] **Sidebar New Chat/toggle consolidation** — implemented Option 1:
      "New Chat" pinned as the first `ICON_RAIL_ITEMS` entry (shared by
      both desktop `.icon-rail--compact` and mobile
      `.icon-rail-mobile-sheet`, since both already `.map()` the same
      array), clicking it auto-reopens the sidebar when collapsed
      (desktop only — mobile's `handleNewChat` already closes its own
      overlay, so auto-opening there would just flash-and-close). Removed
      the floating `.toggle-btn--floating` sidebar-toggle button and its
      `.floating-actions--left` wrapper entirely (the right-side
      `.toggle-btn--floating.toggle-btn--right-panel` for Aio Output is
      untouched). Existing `sidebar-close-btn` (X) unchanged. Added a
      12px left margin to the desktop icon rail (`.icon-rail-slot` 76→
      88px, `.icon-rail { left: 12px }`) so it isn't edge-flush to the
      viewport; the mobile sheet variant overrides `left`/`inset` itself
      so it's unaffected.
      Files: `apps/web/src/components/app/app-home-utils.ts`,
      `apps/web/src/components/app/AppHome.tsx`,
      `apps/web/src/app/(app)/app/mockup/02-sidebar-icon-rail.css`.
- [x] Shared focus-trap hook (trap + Escape + focus-restoration) — new
      `apps/web/src/hooks/useFocusTrap.ts`, wired into `SettingsModal`,
      `NotificationsPanel`, `ScheduledTasksModal` (all 3 real
      `role="dialog" aria-modal="true"` components). **Scope correction**:
      the memory-facts panel (`MemoryFactsPanel.tsx`) was checked and is
      not an independent dialog — it has no `role="dialog"` of its own and
      is only ever mounted as tab content inside `SettingsModal`'s already-
      trapped dialog, so a second trap there would double-wrap and fight
      the outer one. Left it alone deliberately (accessibility-auditor,
      Critical — addressed for the 3 real dialogs; 4th was a
      miscount in the original finding).
- [x] Added `aria-live`/`role="status"` regions for async/streaming state:
      `RunTimeline.tsx`'s list wrapper is `aria-live="polite"` (covers its
      children `ToolCallCard`/`ResearchProgressCard` too — no need to
      instrument each nested card separately and risk duplicate
      announcements), plus `role="status"` on its loading/error rows and
      those in `NotificationsPanel`/`ScheduledTasksModal`
      (accessibility-auditor, Critical).
- [x] `friendlyFetchError()` shared helper
      (`apps/web/src/lib/aio/friendly-fetch-error.ts`) — flat HTTP-status
      lookup + generic fallback. Replaced all 21 raw
      `` `status ${res.status}` `` error strings in `AppHome.tsx` (3 of
      them kept an existing `data?.message`/`data?.error` server message
      as the primary text, only swapping the raw-status fallback)
      (product-ux-guardian).
- [x] Nested-card visual-clutter refactor in `RunTimeline.tsx` — removed
      the outer `rounded-lg border ... bg-[var(--surface-primary-opaque)]`
      card chrome (each event already renders its own card via
      `ToolCallCard`/`ResearchProgressCard`/`ApprovalCard`/`ArtifactCard`),
      leaving a plain header + list. `.current-run-timeline .rounded-lg`
      background rule still paints the per-event cards, so no CSS change
      needed there (full-pass Kimo, Major).
- [x] Mobile double-button confusion — resolved as a side effect of the
      sidebar-toggle removal above: the mobile hamburger
      (`icon-rail-mobile-toggle`) is now the only top-left circular
      control; the second, visually-identical sidebar-toggle button is
      gone (ux-researcher).
- [ ] Onboarding no-op question — **not touched this pass**, explicitly
      out of scope (`OnboardingOverlay.tsx` and
      `apps/web/src/app/api/onboarding/route.ts` excluded from this
      brief). Still needs an owner call: wire up vs. soften/remove copy.

Also resolved the "BYOK/Model Providers reframe" open decision gate below
(group by capability, chosen over gating behind Advanced): added
`CredentialCategory`/`CREDENTIAL_CATEGORY_LABELS` to
`apps/web/src/lib/hermes/credentials.ts` (language/creative/automation/
memory, 1:1 on today's 4 known credentials), propagated `category` through
`/api/credentials/route.ts`'s GET response (both dev-env and prod-Vault
branches) and the `CredentialStatus` type
(`app-home-types.ts`/`SettingsModal.tsx`), and grouped the Settings →
"Model Providers" tab list under capability subheadings instead of one flat
list.

### Open decision gates (flagged, not silently resolved)

- Monospace/NaturalMono-everywhere typeface direction (product-ux-
  guardian finding #11): keep app-wide, or scope back to code/log
  content only. Not addressed this pass.
- Onboarding no-op question: wire up real logic vs. soften/remove copy.
  Not addressed this pass (explicitly out of scope).

Status: **R11.5a done (2026-07-05)**. **R11.5b: 6 of 7 items done
(2026-07-05)** — typecheck/lint clean (0 new errors, warning count
unchanged at 306 pre-existing), Playwright run (see evidence log) shows no
regressions vs. baseline. Onboarding no-op question deliberately left for a
separate pass (out of scope per brief). Live-browser visual check still
outstanding for both R11.5a and R11.5b (no browser access this session).

## Evidence Log

Full R11.1-R11.4 evidence log moved to `docs/roadmap/R11_DONE.md`.

- 2026-07-04: R11.5 UI/UX polish pass scoped. Fixed a background-gradient
  artifact directly (removed the second, green `80% 20%` radial-gradient
  layer from `.particles-bg .dot-grid` in `01-base.css`, keeping only the
  blue center-glow layer — verified via Playwright screenshot,
  `aio-app.service` stop/test/restart cycle). Dispatched 5 specialist
  agents in parallel (`kimo` ×2, `accessibility-auditor`,
  `product-ux-guardian`, `ux-researcher`); all completed and their
  findings are itemized above under R11.5a/R11.5b. Also researched two
  external reference products at SwegOn's request (`gh api` +
  `WebFetch`, no cloning): `assistant-ui` (recommend not adopting,
  pattern reference only) and `open-webui` (144k★; no code/pattern
  adoption this pass, feature ideas noted as future backlog only).
  Nothing implemented yet — R11.5 is scoped and split by blast radius
  but not started; sidebar-redesign and onboarding-question decision
  gates need SwegOn's pick before R11.5b can begin. R11.5a has no
  blocking decisions.
- 2026-07-05: R11.5a (all 11 items) implemented and verified statically
  (typecheck/lint/dev-server clean). Full detail moved to
  `docs/roadmap/R11_DONE.md`. Human visual check still needed — see that
  file for exactly what to eyeball.
- 2026-07-05: R11.5b — 6 of 7 items implemented (sidebar consolidation,
  focus-trap hook, aria-live/role=status regions, `friendlyFetchError()`,
  RunTimeline declutter, mobile double-button fix), plus the Model
  Providers capability-grouping decision gate resolved and implemented.
  `npx tsc --noEmit` clean, `npm run lint` unchanged at 306 pre-existing
  warnings / 0 errors. Playwright: stopped `aio-app.service` (shares a
  `.next` lock with Playwright's own dev server on a different port —
  same conflict noted in R11 prior sessions), ran the full suite twice —
  once on this branch (30 passed / 10 failed) and once stashed back to
  the pre-existing baseline (19 passed / 21 failed) — to confirm every
  failure on this branch (all `mobile-chromium`: google-calendar-connect
  ×3, notifications ×4, r11-settings-and-vision ×3) already fails on
  baseline; none are new regressions, and this branch's pass rate is
  higher than baseline's in both runs (this suite has known
  concurrency-sensitive flakiness independent of this change).
  `aio-app.service` restarted after the run. One real bug found and
  fixed in `e2e/app-smoke.spec.ts`: its `/api/credentials` mock fixture
  was missing the new `category` field, which the Settings "Model
  Providers" tab's new grouped rendering needs to place an item in a
  group — added `category` to the two mocked entries there (other specs
  mock an empty `credentials: []` array, unaffected). Onboarding no-op
  item explicitly left untouched (out of scope). No live-browser visual
  check performed (no browser access this session) — still outstanding
  for both R11.5a and R11.5b.
