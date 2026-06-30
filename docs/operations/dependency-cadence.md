# Dependency & security cadence

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30

Automated checks that run on every change, plus the recurring human cadence that
complements them.

## Automated (every push / PR)

Run by `.github/workflows/ci.yml`:

- **Gitleaks** full-history secret scan (`security` job).
- **`npm audit --audit-level=high`** on production deps (`security` job).
- **dependency-review-action** on PRs, `fail-on-severity: high` (`security` job).
- **prod-env-guard** — confirms the production required-secrets set stays
  satisfiable (`quality` job).

## Scheduled (weekly)

`.github/workflows/security-cadence.yml` (added R6.6) runs on `main` weekly:

- `npm audit --audit-level=high` (informational; surfaces drift between PRs).
- Gitleaks full-history scan (defense-in-depth against a leaked secret slipping in
  outside a PR).

This workflow is **informational** — it does not block merges. Triaging its
findings is part of the monthly review below.

## Dependabot

`.github/dependabot.yml` (added R6.6) opens grouped PRs weekly for:

- `npm` dependencies in `apps/web`.
- `github-actions` used across `.github/workflows/`.

Grouped minor/patch to keep PR noise low. Review and merge on the monthly cadence;
treat any `high`/`critical` advisory as priority regardless of cadence.

## Human cadence

| Cadence | Activity |
|---|---|
| Weekly | Triage `security-cadence.yml` output + open Dependabot PRs. |
| Monthly | Dependency review: bump patch/minor; confirm no breaking surface in `apps/web` lockfile. Pull the 30-day SLO burn chart (`SLO.md` review). |
| Quarterly | Major-version upgrade window: pick one major bump (e.g. Next.js / React / supabase-js), branch, run full CI + e2e + smoke, merge if green. Run the [backup restore-test](./backup-restore.md). |
| On advisory | Any `high`/`critical` CVE: patch immediately via a PR, do not wait for cadence. |

## Secret rotation (owner-gated — execution)

Rotation **cadence** is documented here; **execution** (generating new keys and
cutting over) is owner-gated because it touches live credentials and is not
automated.

| Secret | Rotation cadence | Notes |
|---|---|---|
| Supabase service-role key | Annually, or on suspected exposure | Rotate in Supabase dashboard; update `.env.local` + hosting env; restart app |
| Paddle API key / webhook secret | Annually, or on staff turnover | Update `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET`; verify webhook delivery |
| OpenRouter key | Annually, or on quota/anomaly | See `RB-007-openrouter-key-usage-stale.md` |
| `HERMES_DEV_API_SERVER_KEY` | n/a | Development-only; must be **unset** in production (prod-env-guard enforces) |

Never commit rotated values. The historical GitHub-token finding requires
owner-led revocation/history decision (per `CLAUDE.md`); this cadence does not
touch it.

## Related

- `.github/workflows/ci.yml`, `.github/workflows/security-cadence.yml`,
  `.github/dependabot.yml`.
- [deployment.md](./deployment.md) (restart after rotation),
  [incident-response.md](./incident-response.md),
  `RB-007-openrouter-key-usage-stale.md`.
