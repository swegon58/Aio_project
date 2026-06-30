# Rollback procedure

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30

Aio's deployment is the self-hosted systemd stack (see
[deployment.md](./deployment.md)). Rollback means restoring a known-good state of
**code** and, if needed, **schema**. Because migrations are forward-only, schema
rollback is a forward migration, not an undo.

## Decision: code-only vs code + schema

- **No migration shipped with this deploy** → code-only rollback (fast, safe).
- **A migration shipped and was pushed to remote** → code rollback + decide
  whether the schema also needs reversing (see below).

## Code rollback

```
cd /home/swegon/AI_Agent/Aio_project
git log --oneline -10                      # identify the last known-good SHA
git revert <bad-sha>                       # preferred: a revert commit on main
# — or, for a fast emergency flip —
git checkout <known-good-sha> -- .         # only if a clean revert isn't viable
cd apps/web && npm ci && npm run build
cd ../..
scripts/aio-online.sh restart
scripts/aio-smoke.sh
```

Prefer `git revert` (preserves history; no force-push — CLAUDE.md forbids history
rewrites). Run `aio-smoke.sh` after restart; the rollback is not complete until it
passes.

### Roll back just one plane

Because the four units are independent, an app-only regression can be rolled back
without touching Hermes:

```
scripts/aio-online.sh restart   # restarts all; or target one unit:
systemctl --user restart aio-app.service
```

To run a **prior Hermes/job-worker build** alongside the current app, check out the
prior SHA in a worktree and restart only the runtime units.

## Schema rollback (forward-only)

There are no down-migrations. To reverse a schema change that already reached
remote:

1. Ship a **new** migration (next number) that reverses it — `drop column`,
   `drop table`, backfill/null as needed. Apply locally, run `db lint`, merge via CI.
2. Promote it: `npx supabase db push` (see [migrations.md](./migrations.md)).
3. Then roll back the code (above) to the version compatible with the reversed
   schema.

Only if a migration was pushed to remote but the schema change must be fully
treated as "never happened" (rare, e.g. a duplicate-policy error that left no
trace): use `migration repair --status reverted` to un-mark it in history — this
rewrites history only, not schema (see [migrations.md §3](./migrations.md)). Record
the action in the release checklist.

## Data loss caveat

Any rollback path that drops columns/tables **destroys data**. Confirm with the
owner before shipping a reversing migration. `aio_audit_log` is append-only and
SET-NULLs `user_id` on user deletion (compliance default) — it is not rolled back.

## Related

- [deployment.md](./deployment.md) — the normal deploy/restart flow.
- [migrations.md](./migrations.md) — promotion + repair details.
- [release-checklist.md](./release-checklist.md) — where rollback is rehearsed.
