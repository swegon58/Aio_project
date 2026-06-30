# R6 Execution Checklist

Goal: close the consumer-product gaps blocking a beta launch — onboarding,
auth/tenant security, billing correctness, legal pages, deployment/ops,
analytics, and the beta gate itself.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## Current State

- `main` contains the merged R0-R5 baseline.
- Active delivery branch: `feat/r5-r7-delivery-line` (R5, R6, R7 share this
  branch per owner override).
- Proceeding strictly in order: R6.1 -> R6.8, then R7.

## R6 Checklist

### R6.1 Onboarding

- [x] `hermes_registry` gains `onboarded_at` / `activated_at`
      (`apps/web/supabase/migrations/0020_aio_onboarding_state.sql`)
- [x] `markActivatedIfNeeded` — idempotent, DB-guarded first-success-only flip
      (`apps/web/src/lib/hermes/registry.ts`)
- [x] `GET`/`POST /api/onboarding` — read/persist onboarding completion
      (`apps/web/src/app/api/onboarding/route.ts`)
- [x] `OnboardingOverlay.tsx` — single welcome-screen card (use-case chips,
      one factual data-use sentence, Skip/Got it), no policy page, no
      provider/model names surfaced
- [x] Wired into `AppHome.tsx`: shown only when `onboardedAt === null` and
      the welcome screen has no messages yet
- [x] Activation hooked into `run-orchestrator.ts`'s existing
      `succeeded && !budgetExceeded` branch; emits `METRICS.USERS_ACTIVATED`
      once per user
- [x] Unit test: `registry.test.ts` — first call flips + returns true,
      second call returns false (idempotency)
- [x] `npm run typecheck` clean
- [x] `npm run test:unit` — 157/157 passing
- [ ] Manual dev-server verification (overlay shows once, Skip/Got-it both
      persist across reload, activation fires once on first successful run
      and not on the second) — **gated**: the running dev server points at
      the remote Supabase project (`xeuvoaedwdmuhxdcoxcx.supabase.co`), and
      migration `0020` has not been pushed there (no CLI access token in
      this environment; CI only applies migrations to a throwaway local DB
      for linting). Owner must run
      `npx supabase link --project-ref xeuvoaedwdmuhxdcoxcx && npx supabase db push`
      before this can be exercised live.

### R6.2 Auth And Tenant Security Audit

- [x] CSRF / origin checks on state-changing API routes
      (`apps/web/src/lib/security/origin-check.ts`, wired into
      `apps/web/src/middleware.ts`; rejects unsafe-method `/api/*` requests
      whose Origin/Referer host doesn't match Host, exempting
      `/api/billing/webhook`; passes through when neither header is present)
- [x] Expanded rate limiting coverage
      (`apps/web/src/lib/security/rate-limit.ts`, in-memory per-process
      fixed-window limiter, keyed by `userId`; applied to chat
      (`run-orchestrator.ts`, 20/min), image generation
      (`api/images/generate`, 10/min), knowledge upload
      (`api/knowledge` POST, 10/min), schedule creation (`api/cron` POST,
      20/min), checkout (`api/billing/checkout`, 10/min))
- [x] Unit tests: `origin-check.test.ts`, `rate-limit.test.ts`
- [x] `npm run typecheck` clean
- [x] `npm run test:unit` — 165/165 passing

### R6.3 Billing And Credits

- [x] Paddle webhook idempotency (double-credit risk identified in prior
      survey): `aio_paddle_webhook_events` table
      (`apps/web/supabase/migrations/0021_paddle_webhook_events.sql`,
      unique constraint on `paddle_event_id`); webhook route inserts the
      event id before granting credits/plan, skips processing on conflict
      (`apps/web/src/app/api/billing/webhook/route.ts`);
      `PaddlePaymentProvider.handleWebhook` now parses `event_id` from the
      Paddle payload (`apps/web/src/lib/billing/payment-provider.ts`)
- [x] Unit tests: `payment-provider.test.ts` covers `event_id` parsing and
      signature rejection
- [x] `npm run typecheck` clean
- [x] `npm run test:unit` — 167/167 passing
- [ ] Live verification (real Paddle redelivery doesn't double-credit) is
      gated behind a configured Paddle seller account
      (`PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET` not yet set; falls back to
      `DevNoopPaymentProvider`) — same gate noted in prior surveys

### R6.4 Usage And Plan UX

- [x] Current plan, monthly price, and per-toolset entitlements — already
      shown on the existing `SettingsModal.tsx` "Plan" tab
- [x] Credits remaining / reset date — already shown via `/api/credits`
      (`useCredits` consumer in `AppHome.tsx`); `resetAt` is a synthetic
      "1st of next UTC month" placeholder (`nextMonthlyResetAt()` in
      `pricing.ts`), not yet tied to a real Paddle billing-cycle date —
      documented limitation, same gate as R6.3's live Paddle verification
- [x] Clear upgrade/manage action — already wired (`handleUpgrade` ->
      `/api/billing/checkout`) on the "Plan" tab
- [x] Estimated cost before unusually expensive work — surfaced the
      per-tier `caps.creditBudget` (max credits a single task can spend)
      as a plain-language line on the "Plan" tab
      (`apps/web/src/components/app/SettingsModal.tsx`); the architecture
      has no per-operation (image/video-gen vs. chat) cost model to predict
      an exact per-request price, so the per-task ceiling is the accurate,
      honest estimate available today
- [x] Budget-stop reason without internal pricing jargon — fixed a real
      bug: the chat transport throws the raw 402 JSON response body as
      `error.message` (ai-sdk's `DefaultChatTransport`), so an
      `insufficient_credits` rejection was rendered to users as raw JSON
      with an always-failing "Retry" button. `AppHome.tsx` now detects the
      `insufficient_credits` shape and renders a clean message with a
      "View plans" CTA that opens `SettingsModal` directly to the "Plan"
      tab (new `initialTab` prop); all other chat errors keep the original
      raw-message/Retry banner. The existing mid-stream budget-exceeded
      message ("Budget exceeded for this task. Reply to continue or start
      a new task.", `run-orchestrator.ts`) was already jargon-free.
- [x] `npm run typecheck` clean
- [x] `npm run test:unit` — 167/167 passing (no new tests needed; this was
      a UI-surfacing/copy change, no new branching logic to unit test)

### R6.5 Legal Pages

- [ ] Terms / Privacy content (legal-review gated)

### R6.6 Deployment And Ops

- [ ] TBD — see `AIO_MASTER_EXECUTION_PLAN.md` for scope

### R6.7 Analytics

- [ ] TBD — see `AIO_MASTER_EXECUTION_PLAN.md` for scope

### R6.8 Beta Gate

- [ ] TBD — see `AIO_MASTER_EXECUTION_PLAN.md` for scope

## Exact Next Step

R6.1, R6.2, R6.3, and R6.4 are implemented and verified
(`npm run typecheck` clean, `npm run test:unit` 167/167 passing). Two live
gates remain open from earlier sub-phases, both owner-side:

- R6.1 manual dev-server verification — needs remote migration push:
  `npx supabase link --project-ref xeuvoaedwdmuhxdcoxcx && npx supabase db push`
  (migration `0020` is not yet on the remote Supabase project).
- R6.3 live Paddle redelivery check — needs a configured Paddle seller account
  (`PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`; currently `DevNoopPaymentProvider`).

Next: **R6.5 Privacy, Legal, And Data Controls** (see `AIO_MASTER_EXECUTION_PLAN.md`
for scope). Note that R6.5 splits into two tracks: (a) legal text — gated on
qualified legal review before public launch, not code; (b) product controls
(account data export, account/data deletion, delete knowledge source + derived
content, configurable retention) — these are implementable now. Proceed with
the implementable product controls and surface the legal-review gate for owner
decision.
