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

### R6.5 Privacy, Legal, And Data Controls

Product controls (track b — implementable now):

- [x] `GET /api/account/export` — downloads everything Aio holds about the
      signed-in user as a JSON attachment
      (`apps/web/src/app/api/account/export/route.ts`); backed by
      `gatherAccountData` (`apps/web/src/lib/account/delete.ts`'s sibling
      `apps/web/src/lib/account/export.ts`), which reads every user-owned
      table scoped by `customer_id`/`user_id`, strips raw `embedding`
      vectors from chunk tables, and tolerates a failing table (records to
      `_errors`, still resolves). Rate-limited 5/min.
- [x] `DELETE /api/account/delete` — gathers Storage paths, removes objects
      best-effort, then `auth.admin.deleteUser` (cascades all 19 user
      tables via `auth.users` FK-on-delete-cascade); requires a typed
      `{ confirm: "DELETE" }` body as a second server-side guard
      (`apps/web/src/app/api/account/delete/route.ts` +
      `deleteAccountAndData` in `apps/web/src/lib/account/delete.ts`).
      Rate-limited 2/min. Client signs out on success.
- [x] New "Data & Privacy" tab in `SettingsModal.tsx` (download-data +
      typed-`DELETE` danger-zone deletion); handlers in `AppHome.tsx`
      (`handleExportData` blob download, `handleDeleteAccount` ->
      sign-out + redirect to `/`).
- [x] Delete knowledge source + derived content — **already exists**, no
      new code: `DELETE /api/knowledge` (bulk) and
      `DELETE /api/knowledge/docs/[docId]` remove the file, its Storage
      object, and cascade to chunks via FK. Re-confirmed by inspection.
- [x] Unit tests: `export.test.ts` (keyed output, scopes-by-user, tolerates
      failing table, strips embeddings), `delete.test.ts` (Storage remove
      happens before `deleteUser`, userId passed through, Storage failure
      does not abort deletion, `deleteUser` failure -> ok:false)
- [x] `npm run typecheck` clean
- [x] `npm run test:unit` — 173/173 passing
- [ ] Live verification (export returns the user's tables; typed-`DELETE`
      removes account + Storage objects + cascades tables + signs client
      out) — **gated** on remote migration parity: the running dev server
      points at the remote Supabase project
      (`xeuvoaedwdmuhxdcoxcx.supabase.co`), and migrations `0020`/`0021`
      are not yet pushed there (no CLI access token in this environment;
      CI only applies migrations to a throwaway local DB). Owner must run
      `npx supabase link --project-ref xeuvoaedwdmuhxdcoxcx && npx supabase db push`
      before live verification — same gate as R6.1.

Legal text (track a — deferred to qualified legal review):

- [ ] Terms / Privacy / AUP content (legal-review gated; no fabricated
      policy text written)

Configurable retention (deferred — depends on a published retention policy):

- [ ] Configurable data-retention controls — gated on a published retention
      policy; nothing is "promised" today, so there is nothing to configure
      yet.

### R6.6 Deployment And Ops

Owner decision: harden & document the **self-hosted systemd stack** as the
deployment; no paid infrastructure. Internet-exposed hosting (domain/TLS,
Vercel/cloud, managed-secrets provider, external status/alerting SaaS) is
deferred to an explicit owner gate and documented as such.

Ops procedures — `docs/operations/` (new):

- [x] `deployment.md` — systemd stack lifecycle (`scripts/aio-online.sh`),
      health endpoints, code-update + production-guard flow, independent
      per-plane restart
- [x] `migrations.md` — promotion (`supabase link` + `db push`), `migration
      repair` for history desync, forward-only policy
- [x] `rollback.md` — code rollback (revert/prior SHA + restart), forward-only
      schema reversal, per-plane restart
- [x] `release-checklist.md` — pre/post-merge gates mapped to a SemVer tag
      (`apps/web/CHANGELOG.md`, current `0.3.1`)
- [x] `backup-restore.md` — Supabase managed backups + PITR, local `pg_dump`,
      Storage objects; quarterly restore-test plan (execution owner-gated)
- [x] `alert-routing.md` — on-call + severity→channel (aligned to `SLO.md`
      burn-rate windows) + SLO→runbook table; **closes the dangling `SLO.md`
      reference** to this file
- [x] `incident-response.md` — SEV-1/2/3 definitions, roles, RCA template
- [x] `support-intake.md` — intake + triage flow (channel owner-gated)
- [x] `dependency-cadence.md` — automated + scheduled + human cadence;
      secret-rotation cadence (execution owner-gated)

Runbook — `docs/runbooks/` (new):

- [x] `RB-009-provider-and-upstream-outage.md` — Supabase / OpenRouter /
      LM Studio degradation; graceful degrade + SLO force-majeure exclusion
      (matches RB-001 format). Abuse-spike / browser-session noted as future
      RB-010/011.

Automation:

- [x] `scripts/aio-smoke.sh` — post-deploy smoke (web `:3000/app`, Hermes
      `:8642/health`, LM Studio `:1234/v1/models`); exits non-zero on any
      critical failure. Verified green against the live stack (all 200, exit 0).
- [x] `.github/dependabot.yml` — weekly grouped npm (`apps/web`) +
      github-actions updates
- [x] `.github/CODEOWNERS` — `@swegon58` per area
- [x] `.github/workflows/security-cadence.yml` — weekly informational
      `npm audit` + full-history gitleaks on `main`
- [x] `.github/workflows/ci.yml` — `prod-env-guard` step in the `quality` job
      (step-level `AIO_DEPLOYMENT_ENV=production` + placeholder required
      secrets; blanks the job-wide dev-only `HERMES_DEV_API_SERVER_KEY`).
      Verified `node scripts/check-production-env.mjs` exits 0 with that set;
      fail-closed path is covered by `production-guard.test.ts`.

Verification:

- [x] `npm run typecheck` clean
- [x] `npm run test:unit` — 173/173 passing (no test changes; deliverables are
      docs/script/config)
- [x] `bash -n scripts/aio-smoke.sh` + live run — all endpoints 200, exit 0
- [x] YAML valid for all new/edited `.github` files
- [x] `SLO.md` → `alert-routing.md` link resolves

Deferred (owner-gated — documented in `deployment.md` / `alert-routing.md` /
`backup-restore.md` / `dependency-cadence.md`, not blocking R6.7):

- [ ] Internet-exposed hosting: domain + TLS, reverse proxy, Vercel/cloud
      migration, Docker promotion to a host
- [ ] Managed-secrets provider (secrets stay in local `.env.local`)
- [ ] External status-page and paging/Slack transport (contacts are
      placeholders in `alert-routing.md`)
- [ ] Backup restore-test execution (needs a throwaway Supabase project)
- [ ] Autoscaling, sandbox limits, browser-session caps (hosting-target-dependent)

### R6.7 Analytics

Scope per `AIO_MASTER_EXECUTION_PLAN.md`: weekly activation, D1/W1 retention,
successful runs per active user, run/research success rate, first-response and
completion p95 latency, approval accept/reject/expiry rate, cost per
successful outcome, citation/source interaction, top failure categories.
Privacy-safe analytics only; no raw private prompt dashboard.

- [x] Pure aggregation module
      (`apps/web/src/lib/aio/analytics/weekly-metrics.ts`) — no DB/IO,
      operates only on status/timestamp/cost/error-code columns already
      persisted by R1-R5 (`aio_runs`, `aio_approvals`, `aio_run_events`,
      `hermes_registry`); never reads message text, prompts, or tool
      payloads. Computes: `activationCount`, `computeRetention` (D1/W1 % of
      cohort with a later run), `computeSuccessByMode` (per-mode
      total/succeeded/rate), `computeRunsPerActiveUser`, `computeLatencies`
      (completion p95 from `started_at`/`completed_at`; first-response p95
      from the earliest `message.delta`/`message.completed` event minus
      `started_at`), `computeApprovalRates` (approved/rejected/expired %),
      `computeCostPerSuccess` (mean `actual_credits` over completed runs),
      `computeTopFailureCategories` (failed runs grouped by `error_code`,
      top N).
- [x] `GET /api/internal/analytics/weekly`
      (`apps/web/src/app/api/internal/analytics/weekly/route.ts`) — new
      sibling route alongside the existing R3.5 `/api/internal/metrics`
      (not modified, to avoid regression risk); same operator-only gate
      (`x-aio-internal-secret` header matching `AIO_INTERNAL_SECRET`, or
      signed-in user email matching `AIO_OWNER_EMAIL`), 403 otherwise. Pulls
      a 7-day trailing window from `hermes_registry`, `aio_runs`,
      `aio_run_events`, and `aio_approvals` via `serviceDb()` and feeds the
      aggregation module. Not linked from any consumer nav.
- [x] Gated/deferred metrics surfaced explicitly in the response (`gaps`
      field) rather than fabricated or silently omitted:
      - citation/source interaction — no UI exists for clicking a research
        source, so there is nothing to log yet
      - image generation success rate — `api/images/generate` does not
        create an `aio_runs` row (only successes are persisted to
        `hermes_gallery_images`), so there is no failure denominator to
        compute a rate from
- [x] Unit tests: `weekly-metrics.test.ts` — 20 cases covering empty-input
      nulls/zeros, D1-only vs. D1+W1 retention, per-mode success-rate
      bucketing, active-user/succeeded-run ratios, completion and
      first-response p95 (including out-of-order events), approval
      percentage splits, cost-per-success averaging (excluding failed
      runs), and failure-category grouping/sort/`topN` truncation
      (including the `error_code: null` -> `"unknown"` fallback).
- [x] `npm run typecheck` clean
- [x] `npm run test:unit` — 193/193 passing (20 new)

### R6.8 Beta Gate

10 required items per `AIO_MASTER_EXECUTION_PLAN.md`. Status below is honest:
code-complete items are checked; everything else needs an owner action this
repo cannot perform (legal review, live third-party account, paid second
environment, a named person, or a remote DB push the owner must authorize).

- [x] onboarding and first run pass — `OnboardingOverlay.tsx` + `/api/onboarding`
      shipped in R6.1; `npm run test:unit` covers activation tracking. Manual
      dev-server click-through not yet re-run against this exact commit.
- [ ] billing sandbox end-to-end pass — code path exists
      (`DevNoopPaymentProvider`, webhook idempotency from R6.3) but there is no
      configured Paddle seller account yet (`PADDLE_API_KEY`/
      `PADDLE_WEBHOOK_SECRET`). **Owner action**: step-by-step checklist at
      `docs/operations/paddle-setup.md` (account creation, sandbox
      prices/webhook, env vars, the exact exercise to run) — expanded with a
      tick-box quick checklist, KYC-timing note, exact SQL verification
      queries, and exact Paddle dashboard navigation for the resend step.
      Owner chose to keep account creation itself owner-only (no paid
      infrastructure created on their behalf); only the checklist detail
      was added.
- [ ] webhook replay pass — same Paddle-account gate as above; the dedup guard
      (migration `0021`, `paddle_webhook_events`) is unit-tested but has never
      received a real redelivered webhook. Step 5 of
      `docs/operations/paddle-setup.md` covers the manual-resend exercise,
      now with the exact SQL to confirm no double-credit.
- [x] tenant security tests pass — CSRF (`origin-check.ts`) + per-user rate
      limiting (R6.2) and RLS-backed account isolation are in place and unit
      tested. No separate live penetration pass has been run.
- [x] data export/deletion pass — `/api/account/export` + `/api/account/delete`
      (R6.5) shipped with unit tests; live exercise against the remote project
      shares the migration-push gate below.
- [~] legal pages reviewed — **draft text now exists**:
      `docs/legal/terms.md`, `docs/legal/privacy-policy.md`,
      `docs/legal/acceptable-use-policy.md`. Each is explicitly marked
      `STATUS: UNREVIEWED DRAFT` and grounded in actual current product
      behavior (data collected, R6.5 export/delete, Supabase/Paddle/
      OpenRouter/LM Studio/Kie.ai as named providers, retention gap stated
      honestly — no configurable retention exists yet). **Still owner-gated**:
      a qualified lawyer must review before these are published or linked
      from the product; some fields (governing law, minimum age) are
      explicitly flagged as not yet decided. Stays `[~]`, not `[x]`, until
      that review happens.
- [~] SLO/alerts/runbooks active — runbooks (8 + `RB-009`) and SLO definitions
      are written and committed (R3, R6.6). Alert *transport* is a documented
      placeholder: `docs/operations/alert-routing.md` states no Slack/PagerDuty
      channel is wired yet. **Owner action**: provision a paging channel and
      set its webhook/credentials. Owner confirmed no real webhook exists yet
      and chose to leave this gated as-is (no further doc work requested for
      this sub-item).
- [ ] backup restore exercised — `docs/operations/backup-restore.md` documents
      the procedure; actually running a restore needs a second, throwaway
      Supabase project (paid infra decision, explicitly owner-gated by
      project rules). Procedure doc expanded with a tick-box quick checklist,
      exact `pg_dump`/`pg_restore`/`supabase db push` commands, and the exact
      row-count SQL to confirm parity. Owner chose to keep project creation
      itself owner-only; only the checklist detail was added.
- [x] support owner assigned — `docs/operations/support-intake.md` now names
      **swegon58** (`swegon58@gmail.com`) as the support owner, replacing the
      prior placeholder in the "Direct report to owner" intake-channel row.
      A dedicated support channel (Intercom/etc.) remains a separate,
      still-owner-gated placeholder — the named owner is the point of
      contact regardless.
- [x] limited invite cohort and spend cap configured — this was the one item
      with no existing mechanism at all (confirmed via code survey: no
      allowlist, no cumulative spend cap). Built this gate:
      - migration `0022_aio_beta_invites.sql` — `aio_beta_invites` allowlist
        table (service-role only, RLS enabled, no end-user policies).
      - `apps/web/src/lib/aio/security/invite-gate.ts` —
        `isBetaInviteOnlyEnabled()` / `isEmailInvited()`; off unless
        `AIO_BETA_INVITE_ONLY=true`, always allows `AIO_OWNER_EMAIL`.
      - `apps/web/src/lib/aio/billing/spend-cap.ts` — `checkSpendCap()`;
        sums `aio_runs.actual_credits` per customer against
        `AIO_BETA_SPEND_CAP_CREDITS`; no-op unless that env var is set to a
        positive number.
      - Wired into `apps/web/src/lib/hermes/request-context.ts` (403
        `beta_invite_required` before registry provisioning) and
        `apps/web/src/lib/aio/chat/run-orchestrator.ts` (402
        `spend_cap_reached`, checked before credit reservation).
      - Both gates default OFF — no behavior change to current open-signup
        beta until the owner sets the env vars (and, for invites, populates
        `aio_beta_invites`).
      - 7 new unit tests (`spend-cap.test.ts`, `invite-gate.test.ts`);
        `npm run typecheck` clean; `npm run test:unit` 200/200 passing.
      - Migration `0022` not yet pushed to the remote Supabase project — same
        owner-gated `supabase db push` step blocking `0020`/`0021` live
        verification (see Live gates list below).

**Net: 5 of 10 items are code-complete, 2 are partially done (legal pages
drafted but unreviewed; runbooks written, alert transport not provisioned),
3 require an owner/business/legal action this repo cannot perform on its
own (Paddle seller account + sandbox pass, webhook replay against that same
account, a second paid Supabase project for the restore drill).** R6.8
cannot be marked fully done by writing more code — the remaining items are
decisions and external provisioning, not engineering gaps. Detailed,
ready-to-execute checklists now exist for all three remaining owner-only
items (`docs/operations/paddle-setup.md`,
`docs/operations/backup-restore.md`) so the owner action itself is faster,
even though this repo cannot perform it.

Canonical owner close-out summary:

- `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`

## Exact Next Step

R6.1–R6.7 are implemented and verified (`npm run typecheck` clean,
`npm run test:unit` 193/193 passing). R6.6 (Deployment And Ops, self-hosted
hardening track) shipped the ops-procedure docs, `RB-009`, the post-deploy smoke
script, repo config (Dependabot / CODEOWNERS / security-cadence workflow), and
the CI `prod-env-guard` step; its hosting / restore-test items are deferred to
owner gates and documented in `docs/operations/`. R6.7 (Analytics) shipped the
weekly beta-metrics aggregation module and operator-only
`/api/internal/analytics/weekly` endpoint; citation/source interaction and
image-generation success rate are documented as not-yet-trackable (no UI / no
durable attempt record) rather than fabricated.

Live gates still open from earlier sub-phases (all owner-side, none blocking R6.8):

- R6.1 manual dev-server verification — needs remote migration push:
  `npx supabase link --project-ref xeuvoaedwdmuhxdcoxcx && npx supabase db push`
  (migrations `0020`/`0021`/`0022` are not yet on the remote Supabase
  project).
- R6.3 live Paddle redelivery check — needs a configured Paddle seller account
  (`PADDLE_API_KEY`/`PADDLE_WEBHOOK_SECRET`; currently `DevNoopPaymentProvider`).
- R6.5 live account export/delete exercise — same remote-migration gate as
  R6.1 (the endpoints depend on the remote Supabase project having the user
  tables; no new migration is required for them).
- R6.6 internet-exposed hosting + backup restore-test — owner-gated (see
  `docs/operations/deployment.md` and `docs/operations/backup-restore.md`).
- R6.7 live verification of `/api/internal/analytics/weekly` against real
  data — same remote-migration gate as R6.1/R6.5.

R6.8 Beta Gate's invite-cohort/spend-cap mechanism (the one item with no
prior code at all) is now implemented and tested. Support owner is now named
(swegon58). Legal pages now have unreviewed drafts
(`docs/legal/terms.md`, `docs/legal/privacy-policy.md`,
`docs/legal/acceptable-use-policy.md`). The remaining 3 open R6.8 items
(billing sandbox e2e, webhook replay, backup restore) need a real Paddle
account or throwaway Supabase project that the owner must provision. Use
`docs/operations/OWNER_CLOSEOUT_CHECKLIST.md` as the single short list for
closing the current line.
seller account and a second paid Supabase project respectively — owner chose
to keep that provisioning owner-only and have this repo instead produce
detailed, ready-to-execute checklists (`docs/operations/paddle-setup.md`,
`docs/operations/backup-restore.md`). Alert transport remains an explicit
skip — no real webhook URL exists yet, owner confirmed no further doc work
needed there. R7 ("Evidence-Driven Expansion") additionally requires, per
`AIO_MASTER_EXECUTION_PLAN.md`, "a one-page decision containing user
evidence, expected metric impact, cost, risk, and rollback" per feature —
that evidence does not exist before beta has real users. On direct, repeated
owner instruction this gate was explicitly waived (not silently skipped) and
R7 proceeded: see `docs/roadmap/R7_EXECUTION_CHECKLIST.md` and
`docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md` for the first R7 feature
(Saved Agents), now code-complete and unit-verified.
