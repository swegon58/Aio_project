# Owner Close-Out Checklist

Updated: 2026-07-02
Status: remaining owner-only actions to close the current R6/R7 delivery line
(migration push is done — see section 1)

R6 and R7 are already merged to `main`.

This file is the shortest path to finishing the current merged R6/R7 line.
Everything here requires an owner action, external account, legal decision,
or remote environment access that the repo cannot perform by itself.

## What Is Already Done In Repo

- R6.1 through R6.7 are implemented and verified locally.
- R6.8 has no remaining engineering gap inside the repo.
- R7 Saved Agents is code-complete and unit-verified.
- Detailed procedures already exist in:
  - `docs/operations/paddle-setup.md`
  - `docs/operations/backup-restore.md`
  - `docs/operations/alert-routing.md`
  - `docs/legal/terms.md`
  - `docs/legal/privacy-policy.md`
  - `docs/legal/acceptable-use-policy.md`

## Required To Close The Current Line

### 1. Push Remote Supabase Migrations — DONE (verified 2026-07-02)

`npx supabase migration list --linked` confirms `0020`-`0023` are already
applied on the remote project (`xeuvoaedwdmuhxdcoxcx`):

- `0020_aio_onboarding_state.sql` — applied
- `0021_paddle_webhook_events.sql` — applied
- `0022_aio_beta_invites.sql` — applied
- `0023_aio_saved_agents.sql` — applied

This step no longer blocks section 2. Two migrations remain unpushed —
tracked separately since they weren't part of the original R6/R7 line:

- `0024_drop_legacy_knowledge.sql` — destructive (drops two empty legacy
  tables). Per `AIO_PROJECT_STATE.md`, requires explicit owner go-ahead
  before running, asked for separately.
- `0025_openrouter_key_hash.sql` — additive only (`ADD COLUMN IF NOT
  EXISTS`), part of the R8.5 OpenRouter activation steps below.

### 2. Run The Post-Push Manual Product Checks

These are now blocked only by the remote migration push above.

- R6.1 onboarding:
  - overlay shows once
  - `Skip` and `Got it` both persist across reload
  - activation fires on first successful run only
- R6.5 export/delete:
  - export returns the user's data
  - typed `DELETE` removes account data and signs the client out
- R6.7 analytics:
  - `/api/internal/analytics/weekly` returns real data successfully
- R7 Saved Agents:
  - picker selects and clears
  - settings create/edit/delete round-trips
  - `useKnowledge: false` skips knowledge context for that turn

## Still Required For R6.8 Beta Gate

### 3. Configure Paddle Sandbox And Run Billing E2E

Why this matters:

- closes `billing sandbox end-to-end pass`
- closes `webhook replay pass`

Follow:

- `docs/operations/paddle-setup.md`

Minimum evidence to record:

- successful sandbox checkout path
- successful webhook processing
- replay/redelivery does not double-credit

### 4. Get Legal Review On The Draft Policies

Files:

- `docs/legal/terms.md`
- `docs/legal/privacy-policy.md`
- `docs/legal/acceptable-use-policy.md`

Needed from owner:

- qualified legal review
- unresolved business decisions filled in
  - governing law
  - minimum age
  - any publication wording changes

### 5. Provision Alert Transport

Why this matters:

- moves `SLO/alerts/runbooks active` from partial to done

Follow:

- `docs/operations/alert-routing.md`

Needed from owner:

- choose the real paging/alert channel
- provision webhook or credentials
- wire the real destination

### 6. Run The Backup Restore Drill

Why this matters:

- closes `backup restore exercised`

Follow:

- `docs/operations/backup-restore.md`

Needed from owner:

- provision a throwaway Supabase project
- execute the documented restore test
- record that restore parity checks passed

## Recommended Order

1. Push remote migrations
2. Run manual product checks
3. Configure Paddle sandbox and replay webhook
4. Get legal review
5. Provision alert transport
6. Run backup restore drill

## After The Owner Finishes These

An agent can then:

- update `docs/roadmap/R6_EXECUTION_CHECKLIST.md`
- update `docs/roadmap/R7_EXECUTION_CHECKLIST.md`
- update `AIO_PROJECT_STATE.md`
- confirm the merged R6/R7 line is fully closed on `main`

## R8.5 Finding — Per-Customer Provider-Key Isolation — OpenRouter Wired, Daytona Still Shared

Not part of the R6/R7 close-out above — flagged here per the R8 checklist
(`docs/roadmap/R8_EXECUTION_CHECKLIST.md`).

Owner decision (2026-07-01): per-customer OpenRouter key, Aio-provisioned
automatically at profile creation, using OpenRouter's Management/Provisioning
API. Implemented:

- `writeProfileEnv` (`apps/web/src/lib/hermes/provision.ts`) now calls
  `provisionOpenRouterKey(profileName, spendLimitUsd)`
  (`apps/web/src/lib/hermes/openrouter.ts`) with the tier's
  `openrouterMonthlySpendLimitUsd` (`pricing.ts`: starter $15, pro $35,
  business $200/mo) whenever `OPENROUTER_PROVISIONING_KEY` is set in the
  server env.
- The raw provisioned key is stored in Supabase Vault via
  `storeOpenRouterKeyInVault` (ref persisted to
  `hermes_registry.openrouter_key_ref`, migration `0004`); the OpenRouter
  key hash/id is persisted to a new `openrouter_key_hash` column (migration
  `0025_openrouter_key_hash.sql`, drafted, not yet applied) for a future
  `updateOpenRouterKeyLimit` call on plan-tier change.
- If `OPENROUTER_PROVISIONING_KEY` is unset, behavior is unchanged
  (fallback to the shared Aio dev `OPENROUTER_API_KEY`, no ceiling) — so
  this is a no-op until the owner sets the env var.
- `DAYTONA_API_KEY` is still shared across all customers — the same
  per-customer treatment was not requested/scoped for Daytona and remains a
  TODO (Q41) if that's also needed later.

Needed from owner to activate this:

1. Create a **Management/Provisioning API key** (not a regular API key) at
   `openrouter.ai/settings/management-keys`.
2. Paste it into `apps/web/.env.local`, variable `OPENROUTER_PROVISIONING_KEY`
   (placeholder line already added, file is gitignored, never commit it).
3. Apply migration `0025_openrouter_key_hash.sql` (`npx supabase db push`,
   same step as the other pending migrations above).

Verified: typecheck clean, eslint clean, 249/249 unit tests passing. Not yet
verified: an actual live OpenRouter key creation call (needs a real
provisioning key from the owner) and the plan-tier-change ceiling sync
(`updateOpenRouterKeyLimit` exists but has no caller yet — separate,
smaller follow-up once this is confirmed working).

## Not Required To Close This Line

These are still intentionally deferred and should not block close-out:

- internet-exposed hosting migration
- managed secrets provider
- external status page
- autoscaling or sandbox/browser-session caps
- configurable retention controls before a published retention policy exists
