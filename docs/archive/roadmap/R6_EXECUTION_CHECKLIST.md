# R6 Execution Checklist

Goal: close the consumer-product gaps blocking a beta launch — onboarding,
auth/tenant security, billing correctness, legal pages, deployment/ops,
analytics, and the beta gate itself.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Current State

R6 is engineering-complete and merged to `main`. CI is green
(`.github/workflows/ci.yml`, all jobs). Remaining work is owner-only — see
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` for the single short list
(migration push, manual checks, Paddle sandbox, legal review, alert
transport, backup restore drill).

## R6 Checklist

### R6.1 Onboarding — done

`hermes_registry.onboarded_at`/`activated_at` (migration `0020`),
`markActivatedIfNeeded` (idempotent, first-success-only), `/api/onboarding`,
`OnboardingOverlay.tsx`, activation hooked into `run-orchestrator.ts`. Manual
dev-server verification gated on remote migration push (see
`OWNER_CLOSEOUT_CHECKLIST.md`).

### R6.2 Auth And Tenant Security Audit — done

CSRF/origin checks (`apps/web/src/lib/security/origin-check.ts`, wired into
`middleware.ts`) and per-user rate limiting
(`apps/web/src/lib/security/rate-limit.ts`) across chat, image generation,
knowledge upload, schedule creation, and checkout.

### R6.3 Billing And Credits — done

Paddle webhook idempotency: `aio_paddle_webhook_events` table (migration
`0021`, unique on `paddle_event_id`); webhook route inserts the event id
before granting credits/plan. Live redelivery verification gated on a
configured Paddle seller account (see `paddle-setup.md`).

### R6.4 Usage And Plan UX — done

Plan/credits/upgrade surfaced on `SettingsModal.tsx`; per-task credit
ceiling shown as plain language; fixed raw-402-JSON budget-stop bug in
`AppHome.tsx` with a clean "View plans" CTA.

### R6.5 Privacy, Legal, And Data Controls — done (product track)

`GET /api/account/export` and `DELETE /api/account/delete`
(`apps/web/src/lib/account/export.ts` / `delete.ts`), "Data & Privacy"
Settings tab. Legal text (`docs/legal/terms.md`, `privacy-policy.md`,
`acceptable-use-policy.md`) exists as unreviewed draft — qualified legal
review still owner-gated. Configurable retention deferred until a published
retention policy exists.

### R6.6 Deployment And Ops — done

Self-hosted systemd stack hardened and documented under `docs/operations/`
(deployment, migrations, rollback, release-checklist, backup-restore,
alert-routing, incident-response, support-intake, dependency-cadence) plus
`docs/runbooks/RB-009`, `scripts/aio-smoke.sh`, and repo config (Dependabot,
CODEOWNERS, security-cadence workflow, CI `prod-env-guard`). Internet-exposed
hosting, managed secrets, and external status/paging remain explicit owner
gates.

### R6.7 Analytics — done

Privacy-safe weekly aggregation module
(`apps/web/src/lib/aio/analytics/weekly-metrics.ts`) and operator-only
`GET /api/internal/analytics/weekly`. Citation/source interaction and image
generation success rate are documented gaps (no UI / no durable attempt
record), not fabricated.

### R6.8 Beta Gate — owner close-out only

R6.8 has no remaining engineering work inside the repo. The remaining
close-out is owner-side and consolidated in
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`:

- push remote migrations `0020`-`0023`
- run the post-push manual product checks
- configure Paddle sandbox and verify webhook replay
- get legal review on the draft policies
- provision alert transport
- run the backup restore drill

## Exact Next Step

R6 cannot be advanced further by writing code. Use
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` as the single list for closing
this line. R7 ("Evidence-Driven Expansion") proceeded on direct, repeated
owner instruction with its evidence-gate explicitly waived (not silently
skipped) — see `docs/roadmap/R7_EXECUTION_CHECKLIST.md` and
`docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md`.
