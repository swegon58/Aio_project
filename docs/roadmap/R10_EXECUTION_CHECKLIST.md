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

- [x] `GET /api/connections/google/start` — builds the Google consent URL
      server-side. `state` MUST be a server-generated random nonce with an
      expiry, stored server-side and bound to the session at issue time —
      NOT the customer id or anything else client-derivable/guessable
      (appsec finding: identity-as-state is not CSRF-safe).
      → `apps/web/src/app/api/connections/google/start/route.ts`: 24-byte
      `crypto.randomBytes` nonce in an httpOnly/secure(prod)/sameSite=lax
      cookie scoped to `/api/connections/google`, 10-minute maxAge; returns
      503 via `googleOAuthConfigured()` if owner hasn't set the env vars yet.
- [x] `GET /api/connections/google/callback` — exchanges the code for a
      refresh token server-side; client secret never reaches the browser;
      validates `state` against the server-stored nonce before proceeding.
      → `apps/web/src/app/api/connections/google/callback/route.ts`:
      rejects on missing/mismatched state or Google's own `error` param,
      requires a refresh_token (prompt=consent forces one on every connect).
- [x] Store the refresh token via the **existing** per-customer credential
      vault — `hermes_credential_refs`
      (`migrations/0006_credential_vault.sql`,
      `storeCredentialInVault`/`readCredentialFromVault` in
      `apps/web/src/lib/hermes/registry.ts`) — do not build a new vault
      table (architecture finding: this already exists and does the same
      job as `storeOpenRouterKeyInVault`). A small new `connections` table
      holds only non-secret state: the vault ref, granted scopes, email,
      `connected_at`, `revoked_at`, `last_used_at` (needs its own
      migration).
      → `migrations/0027_google_calendar_connections.sql` (google_email,
      granted_scopes, connected_at, revoked_at, last_used_at); full token
      JSON stored under vault key_name `google_calendar_token` via the
      existing generic `storeCredentialInVault`/`readCredentialFromVault`.
- [x] Bridge the stored token into the customer's isolated Hermes profile as
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
      → `apps/web/src/lib/hermes/google-calendar.ts`'s
      `writeGoogleTokenFile()`/`deleteGoogleTokenFile()`, targeting
      `profileDir(profileName)/google_token.json` (profile root — same
      directory as `.env`/`config.yaml`, not `profileHomeDir`), `0600`
      perms; `row.profile_name ?? "aio"` fallback matches the existing
      `/api/connections/token` pattern for the pre-provisioning case.
- [x] Known accepted debt, not a blocker: the token file sits on disk in the
      profile dir (same posture as the OpenRouter key in `.env`, which
      `provision.ts` already flags as a "Phase-1 placeholder, TODO: replace
      with Vault pointer"). This plan does not regress that posture, but a
      Google Calendar grant lives far longer than a spend-capped OpenRouter
      key — track "inject secrets at process start instead of writing to
      disk" as a follow-up hardening item covering both, not scope for this
      pass.
- [x] Before building the bridge: verify whether the skill's own
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
      → Verified diagnostic-only: `_missing_scopes_from_payload` is only
      referenced inside `setup.py`'s own `print(...)` status lines
      (`check_auth`/`check_auth_live`/`exchange_auth_code`, the interactive
      CLI's `auth-status`/`--exchange` commands). `google_api.py` (the
      runtime path the agent's tool calls actually go through) has zero
      references to it — a Calendar-only grant works at runtime; the
      "missing 7 scopes" text is CLI-only cosmetic noise, not a gate.
- [x] Settings UI: a "Connect Google Calendar" card, living inside a shared
      "Connections" section/heading alongside the existing `KNOWN_PLATFORMS`
      list (`apps/web/src/lib/hermes/platforms.ts`, deliberately scoped to
      "paste a token" — Calendar's OAuth flow is different enough to need
      its own connected/disconnected component, but should not read as an
      unrelated feature — product/UX finding). At connect time, state in
      Aio's own words (not just Google's consent-screen boilerplate) that
      Aio only creates events on the primary calendar and never reads
      Gmail or Drive.
      → `SettingsModal.tsx`'s "Connected Apps" tab: dedicated Google
      Calendar card above the existing platform list ("Other apps" heading
      added to separate them), Connect link → `/api/connections/google/start`,
      Disconnect uses the same two-click confirm pattern as token removal.
      State/fetch wiring in `AppHome.tsx` (`googleCalendarStatus`,
      `loadGoogleCalendarStatus`, `handleGoogleCalendarDisconnect`); the
      OAuth callback redirects back to `/` with a `google_calendar` query
      param that a mount-time effect uses to reopen Settings on the
      Connections tab, then strips the param via `history.replaceState`.
- [x] Disconnect action: call Google's real revoke endpoint
      (`https://oauth2.googleapis.com/revoke`) with the token, THEN clear
      the Vault ref and set `revoked_at`. Clearing the Vault ref alone does
      not revoke the grant on Google's side — the authorization would stay
      live indefinitely even though Aio "forgot" it (appsec finding).
      → `apps/web/src/app/api/connections/google/disconnect/route.ts`:
      revoke call happens before clearing `hermes_credential_refs`, deleting
      the profile token file, and setting `revoked_at`.

**Status (2026-07-03): engineering + UI verification complete.**
Owner completed the four Google Cloud setup steps; server-side OAuth
flow live-verified. Self-tested via a new Playwright spec,
`apps/web/e2e/google-calendar-connect.spec.ts` (4 tests: not-connected
Connect link, not-configured disabled Connect link, connected
email + two-click disconnect, OAuth-callback tab reopen) — all 4 now
passing after fixing two real UI bugs the tests caught (not test
artifacts):
  1. **CSS flex-squeeze bug**: the Google Calendar card's Connect/
     Disconnect control reused the shared `.mcp-add-btn` class, which
     has `width: 100%` (`mockup.css`). Inside the card's flex row
     (`.mcp-server-info { flex: 1; min-width: 0 }` sibling), that
     100%-width button squeezed the status-text column to a 0×0 box —
     visually, the "Connect" pill overlapped/hid the status text
     ("Not available yet" / the connected email). Fixed by adding
     `width: "auto", flexShrink: 0` to the button/link's inline style
     in `SettingsModal.tsx` (scoped to the two call sites, not the
     shared class, so other full-width usages of `.mcp-add-btn`
     elsewhere are untouched). The identical pattern was found and
     fixed in `NotificationsPanel.tsx`'s "Mark read" and "Mark all
     read" buttons (same class, same squeeze risk) during regression
     testing.
  2. **Stale-tab bug after OAuth callback**: `SettingsModal.tsx`'s
     `const [tab, setTab] = useState(initialTab ?? "general")` only
     applies `initialTab` on first mount. Since the modal stays
     mounted (gated by an internal `if (!open) return null`), when
     `AppHome.tsx`'s OAuth-callback effect later sets
     `settingsInitialTab` to `"connections"` and reopens the modal,
     `tab` did not update — Settings reopened on "Personalization"
     instead of "Connected Apps", breaking the advertised "reopen on
     Connected Apps tab after Google Calendar connect" behavior for
     real users. Fixed with a `useEffect` that syncs `tab` to
     `initialTab` whenever the modal opens.
`npx tsc --noEmit` clean, lint clean (no new errors), `npm run
test:unit` 258/258 passing, full Playwright suite (app-smoke,
notifications, research-export, google-calendar-connect) 12/12
passing. `app-smoke.spec.ts`'s mock allowlist was also stale (missing
`/api/notifications` and `/api/connections/google`, both added by
R10.1/R10.2) — updated so the "no unexpected requests" assertion
reflects current app behavior.

**Kimo UI review (2026-07-03), scoped to `SettingsModal.tsx` (all 4
tabs) + `NotificationsPanel.tsx`** — found and fixed 6 more issues
directly (`tsc --noEmit` clean after each):
  1. **Critical — Settings modal broken on mobile.** `.settings-modal`
     (`mockup.css`) used a fixed `240px` sidebar with no responsive
     override; below ~640px the content panel was squeezed to ~118px,
     wrapping/clipping tab titles and platform names. Added a
     `@media (max-width: 640px)` block: single-column layout, sidebar
     becomes a horizontal scrollable tab bar, close button repositioned.
  2. **Major — error text used accent color, not a fixed semantic
     color.** Three "Failed to load" messages used
     `var(--accent-secondary)`, which under the green accent theme
     rendered nearly identical to the "connected" status dot — an
     error read as a positive signal. Changed to a fixed `#e25c5c` (the
     same red already used for "Delete account").
  3. **Major — "Delete my account" button had no visible border.**
     `.mcp-add-btn` sets `border: none`; overriding only `borderColor`
     inline never rendered a border (verified via computed style —
     `borderStyle` stayed `none`). The most destructive action in
     Settings looked identical to a neutral button. Fixed by setting
     the full `border` shorthand.
  4. **Minor — accent swatch color didn't match the applied accent.**
     The "blue" swatch in `mockup.css` was `#0984e3`; the actual
     applied `--accent-primary` for blue is `#0081f2` (matches the
     `ACCENTS` array in `SettingsModal.tsx`). Only blue was off (the
     other 6 accents matched). Fixed the swatch hex to match.
  5. **Minor — delete-confirmation input didn't match other Settings
     inputs.** Used a hand-rolled inline style instead of the shared
     `.message-input` class, so it lost the accent-colored focus ring
     every other input in the modal has. Switched to `className="message-input"`.
  6. **Minor — Notifications error text was a raw error code.** Panel
     rendered bare `{error}` (e.g. just "status 500") with no context.
     Changed to `Failed to load notifications: {error}`.

Two items flagged by Kimo as out of UI scope, not fixed:
  - **No retry affordance on any Settings/Notifications error state** —
    a real gap, but needs a new `onRetry` callback threaded from
    `AppHome.tsx` down; left for a future task, not a small fix.
  - **`/api/notifications` and `/api/connections/google` returned 500
    in the live dev server during Kimo's browser testing.** Root cause
    confirmed: `npx supabase migration list --linked` shows migrations
    `0026` (`aio_notifications`) and `0027`
    (`google_calendar_connections`) exist locally but were never
    pushed to the linked remote Supabase project — the tables the two
    endpoints query don't exist there yet. Not a code bug. Pushing
    these migrations to the shared remote DB needs explicit owner
    go-ahead before it happens (see Owner-only section / next decision
    gate).

Deliberately out of scope for R10.1: Gmail/Drive/Sheets/Docs/Contacts scopes,
multi-calendar selection (primary calendar only), write access beyond
create-event (no delete/update in this pass).

## R10.2 — Proactive Notifications [x]

Closes the `notification destination` field spec'd in
`AIO_MASTER_EXECUTION_PLAN.md` R5.4 but never implemented — no external
blocker, can start immediately.

- [x] New `aio_notifications` table (migration) — minimal shape: user_id,
      source (`scheduled_task` | `research_run`), title, created_at, read_at.
      → migration 0026_aio_notifications.sql (verified).
- [x] Write path: hook into `run-orchestrator.ts`'s existing completion
      `finally` block and into the scheduled-job worker's (`schedule-runtime`)
      completion path.
- [x] In-app delivery: unread-badge + list, minimal UI with per-item task
      attribution (AppHome.tsx). Support mark-all-read.
- [x] Discord delivery (optional per-task destination): Discord toggle in
      `ScheduledTasksModal.tsx` via `notify_discord` column on `aio_schedules`.
- [x] Scheduled Tasks UI: notification destination field added to create/edit
      form, only shown when Discord is connected.

Deliberately out of scope for R10.2: email/push/SMS destinations, granular
per-event-type notification preferences.

Verified 2026-07-02: typecheck clean (npx tsc --noEmit). Commit
`3d45fb9` on `feat/r10-notifications`. E2E spec at
`apps/web/e2e/notifications.spec.ts` — run via Playwright runner only
(`npm run test:e2e:playwright`). Pre-existing vitest failures in
schedule-repo/runtime tests (`mock.module is not a function`) are NOT caused
by R10.2 and remain unaddressed (out of phase scope).

## Ordering Rationale

R10.2 has no external dependency and can start immediately. R10.1's
engineering can be scoped and partly built (routes, migration, UI shell)
ahead of the owner's Google Cloud Console steps, but cannot be
live-verified end-to-end until the owner completes those steps — same
sequencing pattern already used for R8.5 (OpenRouter provisioning key).

## Team Review — 2026-07-02 (pre-implementation, findings folded into checklist above)

4 specialist agents reviewed the plan before code was written: reality-check
(PASS, R9 foundation solid), Hermes architecture (corrected 3 wrong
assumptions — no `writeProfileEnv` reuse, no new vault table, no per-profile
`google_client_secret.json`), appsec (1 accepted-debt CRITICAL: plaintext
refresh token on disk, matches existing OpenRouter posture; 2 HIGH fixed:
CSRF-safe state param, real Google-side revoke call), product/UX (shared
"Connections" section, per-item task attribution, explicit consent copy).
No open item required an owner decision.

## Status

R10.1: engineering + UI verification complete. R10.2: complete. See each
section above for evidence. Remaining: owner go-ahead to push migrations
`0026`/`0027` to the shared remote Supabase project.
