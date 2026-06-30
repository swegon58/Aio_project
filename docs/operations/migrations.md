# Migration promotion procedure

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30

Database schema lives in `apps/web/supabase/migrations/` (currently `0001`–`0021`).
Migrations are **forward-only**: never edit an already-applied migration; always
append a new numbered file. There are no down-migrations by policy
(see [rollback.md](./rollback.md)).

## 1. Develop locally

```
cd apps/web
supabase db start          # fresh local Postgres + all migrations applied
supabase db lint --local --level warning --fail-on warning
```

CI's `database` job runs the same two commands on every push/PR, so a migration
that fails to apply or fails `db lint` blocks the merge.

## 2. Promote to the remote project

```
cd apps/web
npx supabase link --project-ref <project-ref>     # the project behind NEXT_PUBLIC_SUPABASE_URL
npx supabase db push                              # applies any locally-tracked, remote-pending migrations
```

`<project-ref>` is the host of `NEXT_PUBLIC_SUPABASE_URL`
(`https://<project-ref>.supabase.co`). Only push migrations that have already
passed CI locally.

## 3. History desync — repair

If the remote migration history and the remote schema disagree (we have hit this:
migrations marked applied remotely that were not, and a role-ownership mismatch),
`db push` will refuse to proceed. Recover with:

```
npx supabase migration repair --status reverted <migration-name>   # un-mark an entry that isn't really applied
npx supabase migration repair --status applied  <migration-name>   # mark an entry that IS applied but untracked
npx supabase db push                                                # re-run once history matches reality
```

For the role-ownership mismatch (a table/function owned by the wrong role),
connect as `supabase_admin` and reassign ownership, then re-run `db push`. This is
a manual, destructive-by-privilege step — record exactly what was changed in the
release checklist.

> `migration repair` only rewrites the history table; it does **not** change
> schema. Use it to make history match what is already true on disk, never to
> pretend a migration ran when it didn't.

## 4. Rules

- **Forward-only.** To "undo" a schema change, ship a *new* migration that
  reverses it (drop/null the column, etc.).
- **Never rename or edit** an applied migration file — append the next number.
- **Order matters.** The numeric prefix is the apply order; CI applies them in
  lexical order.
- Push **before** restarting the app when a deploy depends on new schema.

## Related

- [rollback.md](./rollback.md) — what "forward-only" means when you need to go back.
- [release-checklist.md](./release-checklist.md) — where the remote push sits in the flow.
- `.github/workflows/ci.yml` — the `database` job that gates merges.
