# Release checklist

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30
**Versioning:** `apps/web/CHANGELOG.md` (Keep a Changelog + SemVer). Current
released version: `0.3.1`. Releases are tagged `vMAJOR.MINOR.PATCH`.

## 1. Pre-merge (on the PR)

- [ ] CI green on all jobs in `.github/workflows/ci.yml`:
      `quality` (lint, typecheck, unit tests, build, **prod-env-guard**),
      `security` (gitleaks full-history, `npm audit --audit-level=high`,
      dependency-review), `database` (`supabase db start` + `db lint --local`),
      `e2e` (Playwright smoke).
- [ ] `npm run typecheck` and `npm run test:unit` clean locally.
- [ ] No new Gitleaks or `npm audit` high-severity findings.
- [ ] If a migration shipped: `supabase db lint --local` passes and the new
      migration is forward-only (no edited applied migration).
- [ ] `apps/web/CHANGELOG.md` `[Unreleased]` section describes the change.

## 2. Merge

- [ ] Squash/merge into `main` (no force-push, no history rewrite).
- [ ] Pull `main` locally: `git -C /home/swegon/AI_Agent/Aio_project pull --ff-only`.

## 3. Post-merge — deploy

- [ ] `cd apps/web && npm ci && npm run build`.
- [ ] `AIO_DEPLOYMENT_ENV=production npm run check:prod-env` passes.
- [ ] If a migration shipped: `npx supabase link --project-ref <ref> &&
      npx supabase db push` (see [migrations.md](./migrations.md)).
- [ ] `scripts/aio-online.sh restart`.
- [ ] `scripts/aio-smoke.sh` passes (web + Hermes + LM Studio healthy).
- [ ] Spot-check one real flow (sign in → chat turn / billing / knowledge).

## 4. Sign-off + tag

- [ ] Move `[Unreleased]` entries under a new `## [X.Y.Z] - <date>` header in
      `apps/web/CHANGELOG.md`, bumping per SemVer.
- [ ] `git tag -a vX.Y.Z -m "Aio vX.Y.Z"` and push the tag.
- [ ] Record the release (SHA, tag, migration names, any `migration repair`
      actions) below or in `AIO_PROJECT_STATE.md`.

## 5. If anything fails post-merge

Follow [rollback.md](./rollback.md). Code-only rollback first; schema reversal
only via a new forward migration. Communicate per
[incident-response.md](./incident-response.md) if user-facing.

## Related

- [deployment.md](./deployment.md), [migrations.md](./migrations.md),
  [rollback.md](./rollback.md), [incident-response.md](./incident-response.md).
