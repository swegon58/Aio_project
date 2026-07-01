# R8 Execution Checklist — Beta-Readiness Hardening

Goal: close the gap between "backend is real" and "external beta user can
use it without hitting a dead end or a security gap." Approved via grilled
decision, not a one-page evidence doc — see
`.claude/grill-logs/grill-log-next-build-observability-provider-adapter-2026-07-01.md`
Round 4 (Câu 14-19) for the full question/option/reasoning record.

Trigger phrase: when the owner says "build Aio tiếp" (or "continue building
Aio"), this is the approved next phase. No further decision gate needed —
start at R8.1 in order unless the owner redirects.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Current State

Not started. This file was prepared ahead of the owner's next session per
their explicit request ("hãy chuẩn bị và khi tôi qua session mới và nói
'build Aio tiếp' là biết nhé").

## Ordering rationale

Quick, low-risk wins first; the one item needing research before it can even
be scoped (R8.5) goes last so it doesn't block everything else from
shipping. `14a` picked external-beta-readiness as the target bar, so R8.4
and R8.5 (normally deferrable for self-use-only) are in scope now, not later.

## R8.1 — Next.js error/not-found pages — not started

Add `apps/web/src/app/error.tsx` and `apps/web/src/app/not-found.tsx` (App
Router convention). Today an unhandled render error or bad route falls
through to Next's default error screen, which is not product-safe for an
external user. Keep copy consistent with existing product tone (see other
user-facing strings in `apps/web/src/components/app/` for style).

## R8.2 — Scheduled Tasks panel UI — not started

Backend and state management are already complete and wired to real
endpoints; only the render is missing. In `AppHome.tsx`: `cronJobs` state,
`loadCronJobs`, `handleCronCreate` (~L1967), `handleCronDelete` (~L1942),
plus `cronName`/`cronSchedule`/`cronPrompt` form state — all call real
`/api/cron` and `/api/cron/[jobId]` routes but are never rendered in any
JSX. Build a panel (likely reachable from the nav rail's currently-dead
"scheduled" icon, see R8.3) that lists jobs and exposes the existing
create/delete handlers. Per the standing UI-testing rule
(`feedback_ui_changes_test_live.md`), this must be clicked through in a live
browser before being marked done, not just typechecked.

## R8.3 — Nav rail dead-icon disabled states — not started

`ICON_RAIL_ITEMS` in `AppHome.tsx` (~L774/784) has entries that render but
do nothing when clicked. Picked `18b`: keep them visible, but make the
disabled state explicit — dimmed styling + a "coming soon" tooltip — rather
than either hiding them or leaving them silently inert. Once R8.2 ships, the
"scheduled" item stops being dead and should be wired to the new panel
instead of disabled.

## R8.4 — Route-level tests for high-risk handlers — not started

Zero test coverage today across all 37 API routes. Scope to the routes
where a bug has real consequences, not full coverage: billing/checkout,
Paddle webhook (`/api/paddle-webhook` or equivalent), account
export/delete (`apps/web/src/lib/account/export.ts` /
`delete.ts` already have unit tests — this item is about the route handlers
that call them), and cron (`/api/cron`, `/api/cron/[jobId]`). Follow the
existing test patterns in `apps/web/src/lib/account/*.test.ts` (fake
Supabase client, no live DB).

## R8.5 — Per-customer secret isolation (Vault) research + scope — not started

Real gap, not scoped yet: confirm (grep `apps/web/src/lib/aio/` and
`apps/harness/aio-home/profiles/aio` for where provider API keys are read)
whether all customers currently share one Aio-owned dev provider key. If
so, this is a hard blocker for onboarding real external users with their
own usage/billing isolation — flag explicitly in
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` once scoped, since the actual
key-management decision (Supabase Vault vs. another secrets store) may need
owner input, not just an engineering call. This task is research-and-scope
only — do not implement a full Vault migration without a follow-up grill
round once the shape of the fix is known.

## Not part of R8

- Migration `0024_drop_legacy_knowledge.sql` (drafted, not run) — separate,
  still-unconfirmed item from the prior grill round (`13b`). Needs its own
  explicit go-ahead before execution; do not fold into R8 work.
