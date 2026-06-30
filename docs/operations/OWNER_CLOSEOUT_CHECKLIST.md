# Owner Close-Out Checklist

Updated: 2026-06-30
Status: remaining owner-only actions to close the current R6/R7 delivery line

This file is the shortest path to finishing the current delivery branch.
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

### 1. Push Remote Supabase Migrations

Why this matters:

- unlocks live/manual verification for R6.1 onboarding
- unlocks live/manual verification for R6.5 export/delete
- unlocks live/manual verification for R6.7 weekly analytics
- unlocks live/manual verification for R7 Saved Agents

Run:

```bash
npx supabase link --project-ref xeuvoaedwdmuhxdcoxcx
npx supabase db push
```

Expected migrations:

- `0020_aio_onboarding_state.sql`
- `0021_paddle_webhook_events.sql`
- `0022_aio_beta_invites.sql`
- `0023_aio_saved_agents.sql`

After this, run the manual checks listed in sections 2 and 3.

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
- confirm the delivery branch is ready for merge evaluation

## Not Required To Close This Line

These are still intentionally deferred and should not block close-out:

- internet-exposed hosting migration
- managed secrets provider
- external status page
- autoscaling or sandbox/browser-session caps
- configurable retention controls before a published retention policy exists
