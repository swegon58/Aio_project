# R17 Execution Checklist — Product Gap Closure

**Status:** locked scope, in progress. Branch: `r15-plan-research-rebuild`.
Created 2026-07-13 from `R17_CANDIDATE_PLAN.md` (3 parallel research agents).
Owner decisions locked (see **Decisions** below). This file is the execution
source of truth — `AIO_PROJECT_STATE.md` keeps the 1-paragraph summary.

## Decisions (locked 2026-07-13, owner)

1. **Scope = Tier 1 + Tier 2 full (9 items).** Owner picked 1C ("cả 3 tier")
   but combined with decision 4 → T1+T2 in-scope here, T3 split out.
2. **Push R16 to main first** (T1#0 prerequisite). R16 `db97a5c` already
   FF-merged into this branch; markers (former blocker) confirmed **gone**
   (grep 2026-07-13: 0 conflict markers across the 3 files STATE flagged).
   Push unblocks the rest onto a clean base.
3. **#1 bug fix = honest async-pending copy**, not auto-restart. Linear
   precedent from R16 ("Added — sign-in still needed"). Applied to BOTH
   `useConnections.ts` AND `useCredentials.ts` (plan missed the credentials
   spot — `useCredentials.ts:60`).
4. **Tier 3 → `docs/roadmap/COMPETITIVE_BACKLOG.md`** (split out of R17).
   R17 stays bug/gap closure; competitive bets compete against the roadmap
   separately, not auto-sequenced here.

## Resumption pointer (read this first on a new session)

- **Next step:** T1#0 (push R16 to main) — see dirty-working-tree note below.
- After T1#0: T1#1 → T1#2 → T1#3 → T1#4 → T2#5..#9 in order.
- Verify gate after each item: `ctx_shell` tsc + Playwright spec for touched
  flow (`.next-e2e` isolation — `aio-app.service` need not stop).
- STATE file may claim conflict markers still present in 3 files — **that is
  stale**, markers verified gone 2026-07-13.

## T1#0 — Prerequisite: push R16 to main

- [ ] Resolve dirty working tree first. ~28 modified + untracked (mobile UX
      E13 CSS, fal.ai swap, R17 docs). **Do NOT lose these** — they are real
      work. Options: (a) commit the unrelated-but-ready work in a separate
      commit before push; (b) `git stash -u` then push then `pop`. (a) is
      safer given the prior stash-pop marker mess — prefer commit.
- [ ] FF main to `db97a5c`: `git push origin r15-plan-research-rebuild:main`
      (branch-to-branch FF push, avoids `checkout main` with dirty tree;
      origin/main `99058d7` is ancestor so FF is allowed).
- [ ] Verify: `git ls-remote origin main` == `db97a5c`.
- [ ] Update STATE "Branches" note — main no longer at `99058d7`.

## Tier 1 — fast, high-confidence fixes

### T1#1 — Fix "restart the gateway" dead-end (decision 3A)

Two independent agents converged here; **widest-confidence item**.

- [ ] `useConnections.ts:142,166` — replace
      `"Saved. Restart the gateway for it to take effect."` /
      `"Removed. Restart the gateway for it to take effect."` with honest
      async copy: **`"Saved — takes effect on the next run."`** /
      **`"Removed — applies on the next run."`**
- [ ] `useCredentials.ts:60` — same swap (plan missed this spot):
      `"Saved. Restart the gateway..."` → `"Saved — takes effect on the next run."`
- [ ] Decide `restartRequired` boolean fate: keep in API response (harmless,
      future-proof if a real restart hook lands) but **stop rendering copy
      that implies user action**. Ponytail: leave API field, fix copy only.
- [ ] Verify: tsc + Playwright `r11-settings-and-vision.spec.ts` (touches
      Settings connections/credentials flow).

### T1#2 — Reconcile R16 vs R15 SettingsModal tabs

- [ ] **Verified 2026-07-13:** on current branch post-R16-FF, SettingsModal
      has tabs `account|general|connections|skills|credentials|plan|data`
      (R16's tabs won the FF). So the "tabs deleted by R15 cleanup" conflict
      the candidate plan feared is **already resolved by the FF**.
- [ ] Audit only: confirm no orphaned references to removed tabs (the
      R15 cleanup comments at `SettingsModal.tsx:14-19` mention Memory/Knowledge
      removal — verify nothing in AppHome still routes to them).
- [ ] If clean → mark done, no code change. (Lazy win: the merge did the work.)

### T1#3 — Wire dead `notificationsUnread` signal

- [ ] **Verified 2026-07-13:** `IconRail.tsx` accepts `notificationsUnread`
      prop but the render body never references it — only `items.map(...)`.
      Signal threads `useNotifications` → `AppHome` → `IconRail` and dies.
- [ ] Render a small unread badge on a bell/notification rail item, OR on the
      relevant item when `notificationsUnread > 0`. Cheapest: a
      `<span className="unread-badge">{n}</span>` conditional in IconRail.
- [ ] Need: which ICON_RAIL_ITEMS entry owns notifications? Check
      `app-home-utils.ts` `ICON_RAIL_ITEMS` — if none, this needs a small
      icon-rail entry decision (grill sub-item at execution time).
- [ ] Verify: tsc + Playwright (add a badge-assertion to
      `app-smoke.spec.ts`).

### T1#4 — Fix Composer "Edit image" misleading entry

- [ ] `Composer.tsx:429-440` — menu entry labeled "New" but `disabled`,
      while a working edit path exists via clicking a generated image's
      reference chip (`useImageGeneration.ts`).
- [ ] Either: (a) wire the menu entry to the existing edit path (open the
      image-edit flow with the selected ref), or (b) remove the misleading
      "New" tag until built. Ponytail: **(b) remove tag** — smallest diff,
      no new wiring; (a) is a feature, defer.
- [ ] Verify: tsc + Playwright composer spec.

## Tier 2 — product-completeness gaps

### T2#5 — Memory visibility UI

Backend (`memorySnapshot.facts/.summary`) wired; `MemoryFactsPanel.tsx` cut
from Settings nav 2026-07-11 with no replacement. #1 externally-requested
AI-agent feature per competitor research + trust gap (onboarding promises
storage, gives no inspect/edit/delete).

- [ ] Decision needed (grill sub-item): restore as Settings tab, OR surface
      inline in chat (a "memory" chip/collapsible), OR both. Recommend:
      **Settings tab** first (consistent with existing tabs, smallest new
      UX surface), inline later.
- [ ] Read/edit/delete over `memorySnapshot.facts` — verify the API exists
      (`/api/preferences` row or memory-specific route) before building UI.
- [ ] Verify: tsc + Playwright Settings spec.

### T2#6 — Restore entry-point CTA to plan/billing + credentials

**Verified 2026-07-13:** `plan`/`credentials`/`skills` tabs EXIST in
SettingsModal (R16 FF restored them). The gap is **no CTA** from
`AppHome.tsx`/`FloatingChrome.tsx` telling a user these exist — a paying
subscriber has no self-serve way to discover tier/key management.

- [ ] Add a discoverable entry to Settings→plan/credentials (e.g. profile
      menu item "Plan & billing", or a badge on the settings icon). Avoid
      re-adding a top-level nav item (icon-rail is intentionally lean).
- [ ] Verify: tsc + Playwright.

### T2#7 — Natural-language scheduling input

`aio-schedule-contract.ts` accepts duration/cron/ISO only; placeholder
assumes cron literacy ("e.g. every 30m, 0 9 * * 1-5").

- [ ] Add NL→schedule parse for the consumer entry ("every day at 9am",
      "in 2 hours", "weekdays at 9"). Keep cron as power-user fallback.
- [ ] Library check first: stdlib/already-installed dep? If not, a small
      regex/keyword parser (~30 lines) beats adding a dep. Ponytail rung 3-5.
- [ ] Verify: tsc + unit test for the parser (the "one runnable check" rule).

### T2#8 — De-jargon the tool-run timeline

`ToolCallCard.tsx` / `tool-metadata-constants.ts` render internal names:
"MCP Integrations", "Research Depth Gate", "Terminal Sandbox".

- [ ] Map internal→consumer labels ("Checking research depth", "Running
      code", "Using integrations"). Single source: `tool-metadata-constants.ts`
      display-name field, consumed by ToolCallCard.
- [ ] Verify: tsc + Playwright (a run that triggers ToolCallCard render).

### T2#9 — Connected Apps scope (post-merge re-verify)

`platforms.ts` covers chat-bot tokens with the same restart-copy bug as T1#1.
R16 Tier A (once on main per T1#0) replaces most with honest Linear/n8n flow.

- [ ] After T1#0: re-verify what's left of `platforms.ts` scope. Likely
      shrinks to just chat-platform rows (Telegram/Discord/Slack/etc.).
- [ ] Apply the same T1#1 honest-copy fix to any remaining chat-platform rows.
- [ ] Verify: tsc + Playwright connections flow.

## Out of scope (this checklist)

- **Tier 3 competitive bets** → `docs/roadmap/COMPETITIVE_BACKLOG.md`.
- Firecrawl+Exa paid keys, Tier C browser-automation appsec — still hard-gated
  per R16 locked decisions.
- Google Calendar OAuth consent screen — pre-existing owner gate (R10).

## Phase closeout (when all T1+T2 verified)

- [ ] `git mv` this checklist to `docs/archive/roadmap/`.
- [ ] Add 1 line to `docs/archive/CLOSED_PHASES.md`.
- [ ] Trim `AIO_PROJECT_STATE.md` R17 section to 1 paragraph (same session).
