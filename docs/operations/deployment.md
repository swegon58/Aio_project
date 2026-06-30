# Deployment — self-hosted always-on stack

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30
**Applies to:** R6.6 self-hosted beta deployment

Aio's de-facto deployment is a **local user-systemd always-on stack** on the
owner's machine. It is not containerized and not internet-exposed. This runbook
documents how that stack is installed, started, updated, and verified. Standing up
an internet-exposed production (domain + TLS, Vercel/cloud hosting, managed
secrets, reverse proxy) is an explicit owner decision — see
[Out of scope](#out-of-scope-owner-gated).

## Prerequisites

| Component | Requirement |
|---|---|
| Node.js | 24 (matches CI; see `apps/web/package.json`) |
| Python runtime for Hermes | `uv` (see `README.md`) |
| Local model server | LM Studio, serving OpenAI-compatible API on `127.0.0.1:1234` |
| Postgres + Auth + Storage | A Supabase project (the one configured as `NEXT_PUBLIC_SUPABASE_URL`) |
| Repo | `/home/swegon/AI_Agent/Aio_project` on `main` |

## Environment (`.env.local` shape)

`apps/web/.env.local` must declare every variable the production guard treats as
required. See `apps/web/src/lib/aio/config/production-guard.mjs`
(`REQUIRED_PRODUCTION_SECRETS`) for the canonical list:

```
NEXT_PUBLIC_SUPABASE_URL            # https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PADDLE_API_KEY
PADDLE_WEBHOOK_SECRET
PADDLE_PRICE_ID_STARTER
PADDLE_PRICE_ID_PRO
PADDLE_PRICE_ID_BUSINESS
PADDLE_PRICE_ID_TOPUP
```

Never commit real values. Two vars are **forbidden** in a production-shaped
deployment and the guard will refuse to start if they are set:

- `NEXT_PUBLIC_DEV_AUTH_BYPASS` must not be `true`.
- `HERMES_DEV_API_SERVER_KEY` must be unset (development-only).

Additional runtime vars (Hermes endpoint, OpenRouter key, LM Studio base URL,
etc.) are documented in `apps/web/.env.local.example`.

## The stack

Four user units + one target, defined in `config/systemd/` and installed into
`~/.config/systemd/user/`:

| Unit | Role |
|---|---|
| `aio-hermes.service` | Hermes gateway (execution/runtime plane) |
| `aio-hermes-supervisor.service` | Hermes supervisor |
| `aio-job-worker.service` | Durable job worker (R5 queue/scheduler) |
| `aio-app.service` | Next.js app (control/product plane) |
| `aio-online.target` | Groups the four units for one-shot start |

Web and the Hermes/job-worker plane restart **independently** (separate units), so
an app-only change does not require touching the runtime plane.

## Lifecycle — `scripts/aio-online.sh`

```
scripts/aio-online.sh install   # copy units, daemon-reload, enable + start, wait for health
scripts/aio-online.sh start     # start + wait for health (units already installed)
scripts/aio-online.sh stop
scripts/aio-online.sh restart   # restart all four units
scripts/aio-online.sh status    # systemctl status + scripts/aio-context.sh
scripts/aio-online.sh logs      # last 200 journal lines across all units
```

`install`/`start` block until the health endpoints answer:

- Web: `http://127.0.0.1:3000/app`
- Hermes: `http://127.0.0.1:8642/health`
- LM Studio: `http://127.0.0.1:1234/v1/models` (checked by `aio-context.sh`)

## Code-update flow

```
git -C /home/swegon/AI_Agent/Aio_project pull --ff-only
cd apps/web && npm ci
npm run build
AIO_DEPLOYMENT_ENV=production npm run check:prod-env   # fail-closed guard
cd ../..
scripts/aio-online.sh restart
scripts/aio-smoke.sh                                     # post-deploy smoke
```

If `check:prod-env` fails, **do not restart** — fix the missing/forbidden env var
first. Run `scripts/aio-smoke.sh` after every restart; a non-zero exit means the
deploy is not healthy (see [rollback.md](./rollback.md)).

When a migration shipped with the update, promote it to the remote Supabase
project **before** restarting the app — see [migrations.md](./migrations.md).

## Out of scope (owner-gated)

These are **not** part of the self-hosted deployment and require an explicit owner
decision (and, for most, paid infrastructure CLAUDE.md forbids choosing without
approval):

- Production domain + TLS / reverse proxy (currently localhost-only).
- Hosting migration: Vercel, or Docker promotion of the existing standalone build
  to a VPS/cloud host.
- Managed-secrets provider (secrets currently live in local `.env.local`).
- Autoscaling, concurrency caps, and browser-session limits (depend on hosting
  target).
- External status-page and paging/Slack transport — see
  [alert-routing.md](./alert-routing.md).

## Related

- [migrations.md](./migrations.md) — promoting schema changes to remote Supabase.
- [rollback.md](./rollback.md) — reverting a bad deploy.
- [release-checklist.md](./release-checklist.md) — full pre/post-merge checklist.
- `SLO.md` — service-level objectives the stack is measured against.
