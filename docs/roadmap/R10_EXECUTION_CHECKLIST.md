# R10 Execution Checklist — Consumer Connect Flow + Proactive Notifications

Trigger: owner grill decision, 2026-07-02 (Discord). Three parallel research
forks (market landscape, tools/repos, internal gap audit) converged on two
directions; owner picked both — see
`.claude/grill-logs/grill-log-next-flagship-phase-2026-07-02.md` for the full
decision record.

- Primary flagship: **R10.1 Google Calendar connect flow** — unlocks a Hermes
  skill (`google-workspace`) that already exists but has no consumer-usable
  connect path.
- Parallel quick win: **R10.2 Proactive notifications** — closes a field
  (`notification destination`) that R5.4 originally spec'd and never built.

## Status Key

- `[ ]` not started
- `[~]` in progress
- `[x]` completed and verified

## R10.1 — Google Calendar Connect Flow [ ]

### Scoping note (found during audit, changes the original framing)

The gap-audit research fork described this as "backend capability already
exists, gap is purely a missing OAuth/UX layer." That undersells the real
shape: `apps/harness/aio-home/profiles/aio/skills/productivity/google-workspace`
is a **CLI-driven, agent-mediated OAuth flow** (`setup.py`) built for a single
operator pasting an auth URL/code through chat — it expects a
`google_client_secret.json` the *user* downloads from their own Google Cloud
project. That is a developer-facing "bring your own OAuth app" flow, not a
consumer "Connect Google Calendar" button.

Two real gaps must close, not one:

1. **Google's own compliance surface.** The skill's default `SCOPES` list
   includes Gmail send/modify and Drive — those are Google "restricted"
   scopes requiring a CASA third-party security assessment (cost + weeks of
   lead time), separate from a normal OAuth app review. Calendar
   (`.../auth/calendar`) is "sensitive," not "restricted" — standard app
   verification only, much faster.
2. **A real web OAuth flow**, not the copy/paste CLI one — Aio needs its own
   registered OAuth client, a server-side callback route, and a way to hand
   the resulting token to the *right customer's* isolated Hermes profile
   (parallel to the per-customer OpenRouter key pattern already shipped in
   R8.5).

**Scope decision for this pass: Calendar only** (read + create events on the
primary calendar). Gmail/Drive/Sheets/Docs/Contacts stay on the
`google-workspace` skill's existing CLI-mediated path, deferred pending a
CASA scoping/cost decision — not part of R10.

### Owner-only (external, blocks nothing else in this checklist)

- [ ] Create a Google Cloud project + OAuth consent screen for Aio
      (not per-customer — one Aio-owned app).
- [ ] Add scope `https://www.googleapis.com/auth/calendar` to the consent
      screen, submit for standard verification (sensitive-scope tier).
- [ ] Register the prod + local redirect URIs
      (`/api/connections/google/callback`).
- [ ] Paste `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` into
      `apps/web/.env.local` (never commit).

### Engineering (can be scoped/built ahead of the owner steps; needs the env
vars to actually run end-to-end)

Design revised 2026-07-02 after a 4-agent team review (security, Hermes
architecture, reality-check, product/UX) of this plan before any code was
written — see "Team Review — 2026-07-02" below for the full findings this
revision resolves.

- [ ] `GET /api/connections/google/start` — builds the Google consent URL
      server-side. `state` MUST be a server-generated random nonce with an
      expiry, stored server-side and bound to the session at issue time —
      NOT the customer id or anything else client-derivable/guessable
      (appsec finding: identity-as-state is not CSRF-safe).
- [ ] `GET /api/connections/google/callback` — exchanges the code for a
      refresh token server-side; client secret never reaches the browser;
      validates `state` against the server-stored nonce before proceeding.
- [ ] Store the refresh token via the **existing** per-customer credential
      vault — `hermes_credential_refs`
      (`migrations/0006_credential_vault.sql`,
      `storeCredentialInVault`/`readCredentialFromVault` in
      `apps/web/src/lib/hermes/registry.ts`) — do not build a new vault
      table (architecture finding: this already exists and does the same
      job as `storeOpenRouterKeyInVault`). A small new `connections` table
      holds only non-secret state: the vault ref, granted scopes, email,
      `connected_at`, `revoked_at`, `last_used_at` (needs its own
      migration).
- [ ] Bridge the stored token into the customer's isolated Hermes profile as
      `google_token.json` in `profiles/<name>/...` at connect time. This is
      **new engineering, not a reuse of `writeProfileEnv`** — that function
      only writes `.env` key=value pairs at fresh-provision/env-loss-respawn
      time (architecture finding). The bridge must run against an
      already-running profile and must handle `hermes_registry.profile_name`
      being NULL (a customer can connect Calendar before Hermes
      provisioning — schema allows this per
      `0002_hermes_registry_multitenant.sql`). Write the file with `0600`
      permissions. Do NOT also write a shared `google_client_secret.json`
      into the profile — confirmed dead weight, `google_api.py`'s runtime
      path never reads it (only `setup.py`'s interactive CLI commands do,
      which this flow never invokes); it only multiplies exfiltration
      surface for an agent with terminal access. Verified: the JSON shape a
      standard web `Flow.fetch_token()` result produces
      (`refresh_token`/`client_id`/`client_secret`/`token_uri`) matches what
      `google_api.py`'s `Credentials.from_authorized_user_file` expects —
      no skill-side code change needed for parsing.
- [ ] Known accepted debt, not a blocker: the token file sits on disk in the
      profile dir (same posture as the OpenRouter key in `.env`, which
      `provision.ts` already flags as a "Phase-1 placeholder, TODO: replace
      with Vault pointer"). This plan does not regress that posture, but a
      Google Calendar grant lives far longer than a spend-capped OpenRouter
      key — track "inject secrets at process start instead of writing to
      disk" as a follow-up hardening item covering both, not scope for this
      pass.
- [ ] Before building the bridge: verify whether the skill's own
      `_missing_scopes_from_payload` check (in `setup.py`, hardcoded to a
      list of 8 scopes) gates actual tool execution or is purely a status
      message. Granting Calendar-only will make it report "AUTHENTICATED
      (partial): missing 7 scopes." If that check gates whether the agent
      will attempt to use calendar tools, it needs a skill-side fix to
      accept a Calendar-only grant as fully authenticated; if it's
      diagnostic-only, the connect UI's own status is authoritative and the
      skill's internal message can be suppressed/ignored. Resolve this
      before shipping — do not leave it as a silent "looks broken to the
      agent" gap.
- [ ] Settings UI: a "Connect Google Calendar" card, living inside a shared
      "Connections" section/heading alongside the existing `KNOWN_PLATFORMS`
      list (`apps/web/src/lib/hermes/platforms.ts`, deliberately scoped to
      "paste a token" — Calendar's OAuth flow is different enough to need
      its own connected/disconnected component, but should not read as an
      unrelated feature — product/UX finding). At connect time, state in
      Aio's own words (not just Google's consent-screen boilerplate) that
      Aio only creates events on the primary calendar and never reads
      Gmail or Drive.
- [ ] Disconnect action: call Google's real revoke endpoint
      (`https://oauth2.googleapis.com/revoke`) with the token, THEN clear
      the Vault ref and set `revoked_at`. Clearing the Vault ref alone does
      not revoke the grant on Google's side — the authorization would stay
      live indefinitely even though Aio "forgot" it (appsec finding).

Deliberately out of scope for R10.1: Gmail/Drive/Sheets/Docs/Contacts scopes,
multi-calendar selection (primary calendar only), write access beyond
create-event (no delete/update in this pass).

## R10.2 — Proactive Notifications [ ]

Closes the `notification destination` field spec'd in
`AIO_MASTER_EXECUTION_PLAN.md` R5.4 but never implemented — no external
blocker, can start immediately.

- [ ] New `aio_notifications` table (migration) — minimal shape: user_id,
      source (`scheduled_task` | `research_run`), title, created_at, read_at.
- [ ] Write path: hook into `run-orchestrator.ts`'s existing completion
      `finally` block (same spot that already emits the `report` research
      stage) and into the scheduled-job worker's completion path.
- [ ] In-app delivery: unread-badge + list, minimal UI (this is the default,
      always-on destination — no per-task opt-in needed for this pass).
      List items must show the task name + outcome at a glance, not just an
      undifferentiated count — a customer with several recurring tasks needs
      to tell them apart without opening each one. Support mark-all-read
      (product/UX finding).
- [ ] Discord delivery (optional per-task destination): if the customer's
      Hermes profile already has Discord connected
      (`KNOWN_PLATFORMS`/`DISCORD_BOT_TOKEN` present), offer "also notify me
      on Discord" and reuse the existing, already-proven Discord bot
      integration to DM on completion. Omit the toggle row entirely when
      Discord isn't connected — do not show it disabled/greyed with no
      explanation (product/UX finding).
- [ ] Scheduled Tasks UI (`ScheduledTasksModal.tsx`): add the notification
      destination field to the create/edit form (in-app default, Discord
      toggle if connected).

Deliberately out of scope for R10.2: email/push/SMS destinations, granular
per-event-type notification preferences.

## Ordering Rationale

R10.2 has no external dependency and can start immediately. R10.1's
engineering can be scoped and partly built (routes, migration, UI shell)
ahead of the owner's Google Cloud Console steps, but cannot be
live-verified end-to-end until the owner completes those steps — same
sequencing pattern already used for R8.5 (OpenRouter provisioning key).

## Team Review — 2026-07-02

Before writing any R10 code, 4 specialist agents reviewed the plan above
(reality-check on the R9 foundation, Hermes architecture on R10.1's design,
appsec on R10.1's OAuth/token handling, product/UX on both R10.1 and R10.2's
flows). All findings are folded into the checklists above; summary:

- **Reality-check: PASS.** `npm run typecheck` and `npm run test:unit`
  verified fresh (258/258), R9's e2e spec and source-dedupe unit tests are
  real and match the state-doc claims, no rot found. One unrelated
  uncommitted local diff flagged for review before next commit:
  `apps/harness/aio-home/profiles/aio/config.yaml` (LMStudio `base_url`
  swapped to a LAN address `192.168.1.5` — looks like local dev-machine
  config, not intended to commit). **Engineering foundation is solid;
  R10 is safe to build on.**
- **Hermes architecture:** cross-customer isolation for the token bridge is
  sound (per-customer `HERMES_HOME` override via `-p <profileName>`), one
  shared OAuth app is the right shape, and the token JSON shape needs no
  skill-side parsing change. But `writeProfileEnv` reuse, a new vault table,
  and shipping `google_client_secret.json` per profile were all wrong
  assumptions — corrected in R10.1's engineering list above.
- **Appsec:** 1 CRITICAL (long-lived refresh token as a plaintext profile
  file — accepted as known debt, matches existing OpenRouter posture, not a
  novel regression, tracked as a follow-up), 2 HIGH (state-param CSRF
  binding, real Google-side revoke call) — both now explicit checklist
  items above.
- **Product/UX:** Connections card should live inside a shared "Connections"
  settings section, notification list needs per-item task attribution, and
  connect-time consent copy needs to be explicit in Aio's own words — all
  folded into the checklists above.

No open item from this review requires an owner decision — all findings
were implementation-design corrections, resolved in-plan. R10.2 remains
unblocked and ready to start; R10.1 engineering can proceed on the revised
design ahead of the owner's Google Cloud Console steps.

## Status

Not started. This checklist is the result of the 2026-07-02 grill decision;
implementation has not begun. Design revised same-day after team review
(see "Team Review — 2026-07-02" above) — still not started.
