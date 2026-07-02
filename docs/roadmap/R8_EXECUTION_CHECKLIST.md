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

R8.1-R8.5 complete. R8.1-R8.4 verified (typecheck + eslint clean, 249/249
unit tests passing including 44 new route-level tests). R8.2's live
browser click-through could not be run in the Discord bot session (Chrome
MCP not connected there); substituted a code/CSS-level review instead —
flagged to the owner, live verification still outstanding. R8.5 is
research-and-scope only per its own task constraint: confirmed all
customers share one Aio-owned OpenRouter/Daytona key, flagged as an
external-beta blocker in `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` for
an owner decision — no Vault migration implemented. All of R8 is now done.

## Ordering rationale

Quick, low-risk wins first; the one item needing research before it can even
be scoped (R8.5) goes last so it doesn't block everything else from
shipping. `14a` picked external-beta-readiness as the target bar, so R8.4
and R8.5 (normally deferrable for self-use-only) are in scope now, not later.

## R8.1 — Next.js error/not-found pages — done

Add `apps/web/src/app/error.tsx` and `apps/web/src/app/not-found.tsx` (App
Router convention). Today an unhandled render error or bad route falls
through to Next's default error screen, which is not product-safe for an
external user. Keep copy consistent with existing product tone (see other
user-facing strings in `apps/web/src/components/app/` for style).

## R8.2 — Scheduled Tasks panel UI — done (live browser verification outstanding)

Built `ScheduledTasksModal.tsx`, a presentational modal wired to the
existing `cronJobs`/`loadCronJobs`/`handleCronCreate`/`handleCronDelete`/
`handleCronAction` state in `AppHome.tsx` (no new fetch logic). Reachable
from the nav rail's "Scheduled" icon (`handleRailItemClick`). Typecheck and
eslint clean. Per the standing UI-testing rule
(`feedback_ui_changes_test_live.md`), this should still be clicked through
in a live browser — could not be done in the Discord session (Chrome MCP
not connected there); a code/CSS-level review was substituted instead.

## R8.3 — Nav rail dead-icon disabled states — done

`ICON_RAIL_ITEMS` in `AppHome.tsx` now carries a `disabled` flag per item.
`agents`, `tasks`, `knowledge`, `analytics` are disabled (native `disabled`
button attribute + dimmed styling via `.icon-rail-item:disabled` /
`.icon-rail-item--compact:disabled` in `mockup.css`, plus a "coming soon"
tooltip/label suffix) instead of silently inert. `home`, `scheduled`, and
`settings` are wired and not disabled.

## R8.4 — Route-level tests for high-risk handlers — done

Added `route.test.ts` next to each high-risk handler: `account/delete` (4
tests), `account/export` (2), `billing/checkout` (5), `billing/webhook` (6,
covering signature rejection, non-checkout events, plan purchase credit
grant + `plan_tier` update, topup credit grant, and both the
duplicate-event-id dedup path and a genuine dedup-insert failure), `cron`
(11), `cron/[jobId]` (16, covering PATCH/DELETE/POST across
pause/resume/run). 44 new tests total, all passing alongside the existing
suite (249/249).

Used Node's built-in `node:test` `mock.module()` (needs the
`--experimental-test-module-mocks` CLI flag, now added permanently to
`test:unit` in `package.json`) to intercept each route's
`@/lib/supabase/*`, `@/lib/account/*`, `@/lib/billing/*`,
`@/lib/hermes/*`, and `@/lib/aio/schedules/*` imports with fakes — no live
DB, same style as the existing `apps/web/src/lib/account/*.test.ts` tests.
Dynamic `import("./route")` happens inside a `before()` hook (top-level
await isn't available since `tsx` transpiles these files to CJS).

Note: the `cron/[jobId]/route.test.ts` file only runs correctly when
invoked directly (`cd` into its directory) or via the `src/**/*.test.ts`
glob used by `npm run test:unit` — running it by exact path from the repo
root through `npx tsx --test "..."` fails silently because the shell/glob
layer treats the literal `[jobId]` folder name as a character class. Not a
bug in the test itself; confirmed the full `npm run test:unit` run picks it
up correctly (16/16 passing as part of the 249-test total).

## R8.5 — Per-customer secret isolation (Vault) research + scope — done

Confirmed: yes, all customers currently share one Aio-owned dev provider
key. `writeProfileEnv` in `apps/web/src/lib/hermes/provision.ts:184-211`
copies the Aio dev profile's own `OPENROUTER_API_KEY` and `DAYTONA_API_KEY`
verbatim into every customer's profile `.env` at provision time — no
per-customer key, no per-customer spend ceiling. The code already carries
a `TODO (Q41)` marking this as a known Phase-1 placeholder.

The Vault plumbing to fix this already exists but is unused for the
OpenRouter/Daytona keys: migration `0004_openrouter_vault.sql`
(`vault_read_openrouter_key`, `hermes_registry.openrouter_key_ref`) and
`0006_credential_vault.sql` (`hermes_credential_refs`,
`vault_store_credential`/`vault_read_credential`). The image-generation
route (`apps/web/src/app/api/images/generate/route.ts`) already uses the
generic credential vault as a working fallback for `KIE_API_KEY` — proving
the pattern, but the primary OpenRouter/Daytona keys bypass it entirely.

This was a real blocker for onboarding real external (non-owner) beta users
with proper per-customer usage/cost isolation. Owner decided (2026-07-01):
per-customer OpenRouter key, Aio-provisioned automatically. Wired as a
follow-up (post-R8, same session): `writeProfileEnv` now calls
`provisionOpenRouterKey` + `storeOpenRouterKeyInVault` when
`OPENROUTER_PROVISIONING_KEY` is set, falling back to the old shared-key
behavior when it isn't. New migration `0025_openrouter_key_hash.sql`
(drafted, not applied). Daytona key is still shared (not in scope for this
round). Full detail and remaining owner steps in
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` under "R8.5 Finding."

## Not part of R8

- Migration `0024_drop_legacy_knowledge.sql` (drafted, not run) — separate,
  still-unconfirmed item from the prior grill round (`13b`). Needs its own
  explicit go-ahead before execution; do not fold into R8 work.
