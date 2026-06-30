# Backup & restore procedure

**Owner:** `@swegon58`
**Last reviewed:** 2026-06-30

Aio's durable state is **Supabase** (Postgres + Auth/GoTrue + Storage). This
document describes what is backed up, how to restore, and the recurring
restore-test plan. **Executing** a restore test against a throwaway project is
owner-gated (it requires provisioning a second Supabase project) — see
[Restore-test plan](#restore-test-plan-owner-gated).

## What is backed up, and by whom

| Data | Mechanism | Owner action |
|---|---|---|
| Remote Postgres (all `aio_*` / `hermes_*` tables) | Supabase **managed daily backups** + 7-day PITR (point-in-time recovery), via the project dashboard | Confirm backups are enabled in the Supabase dashboard |
| Auth (`auth.users` + GoTrue) | Included in Supabase managed backups | — |
| Storage objects (`aio-knowledge`, `aio-images` buckets) | Supabase Storage; export via dashboard/CLI | — |
| Local dev DB | Operator-run `pg_dump` (not managed) | See below |

Supabase backups are a managed feature of the configured project — they are not
something this repo provisions. Verify retention/periodicity in the dashboard and
record the confirmed values here when first checked.

## Restore — remote (managed backup)

1. In the Supabase dashboard for the production project, open
   **Database → Backups**.
2. Choose **Restore from backup** (daily snapshot) or **PITR** (timestamp, within
   the 7-day window).
3. Restore into a **new** project first to validate (see restore-test plan), then
   cut over only after validation. Direct in-place restore of production is a
   last resort — it overwrites live data; confirm with the owner.
4. After cutover: repoint `NEXT_PUBLIC_SUPABASE_URL` if the project ref changed,
   run `scripts/aio-smoke.sh`, spot-check a known record.

## Restore — local dev DB

```
# dump (local supabase stack)
pg_dump "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --format=custom --file=aio-local.dump

# restore into a fresh local stack
pg_restore --clean --if-exists --dbname=postgres aio-local.dump
```

## Restore — Storage objects

Re-upload from the Supabase dashboard export or via the CLI
(`supabase storage cp`/web download). Storage paths are recorded in
`hermes_knowledge_files.storage_path` / `aio_knowledge_docs.storage_path` and are
cleaned on account deletion (R6.5).

## Restore-test plan (owner-gated)

Quarterly (or after any major schema change), verify backups actually restore.
Expect ~30-60 minutes total, most of it waiting on Supabase project
provisioning and the restore job itself.

### Quick checklist

- [ ] Throwaway Supabase project created (free tier is fine — this is a
      restore drill, not a load test)
- [ ] Latest managed backup restored into it
- [ ] `supabase link` + `supabase db push` run against it to reach schema
      parity
- [ ] `scripts/aio-smoke.sh` passes against the restored project
- [ ] Row counts spot-checked against production for the 3 tables below
- [ ] Evidence recorded in `AIO_PROJECT_STATE.md`
- [ ] Throwaway project deleted

### Steps

1. Provision a **throwaway** Supabase project (owner action — new project
   in the same Supabase org, any region; this does not need to match
   production's plan tier). Note its project ref.
2. In the throwaway project's dashboard, go to **Database -> Backups**.
   Since it's brand new it has no backups of its own — instead, use
   **Restore from backup** against the *production* project's dashboard but
   target the throwaway project as the destination if Supabase's UI
   supports cross-project restore; if it does not, fall back to a manual
   dump/restore instead:
   ```
   # pull a fresh dump from production (read-only, safe)
   pg_dump "postgresql://postgres:<prod-password>@<prod-host>:5432/postgres" \
     --format=custom --file=aio-prod-snapshot.dump

   # restore into the throwaway project's connection string
   pg_restore --clean --if-exists \
     --dbname="postgresql://postgres:<throwaway-password>@<throwaway-host>:5432/postgres" \
     aio-prod-snapshot.dump
   ```
   This validates the *data* restores correctly; it's a reasonable
   substitute for Supabase's own managed-backup restore button if that
   button doesn't support a cross-project target, but note in step 6's
   evidence record which path was actually used (managed-backup-restore
   vs. manual pg_dump/pg_restore) since they exercise slightly different
   mechanisms.
3. Apply any pending migrations to reach schema parity:
   ```
   npx supabase link --project-ref <throwaway-project-ref>
   npx supabase db push
   ```
4. Point a local `.env.local` copy at the throwaway project's URL/keys
   (temporary, do not commit) and run `scripts/aio-smoke.sh` against it.
5. Spot-check row counts match production for `aio_runs`,
   `hermes_conversations`, `aio_knowledge_docs`:
   ```sql
   select count(*) from aio_runs;
   select count(*) from hermes_conversations;
   select count(*) from aio_knowledge_docs;
   ```
   Run the same query against production and compare — counts should
   match (or be close, if production took new writes during the test).
6. Record evidence (date, source backup or dump timestamp, restored
   project ref, smoke result, row-count comparison) in
   `AIO_PROJECT_STATE.md`.
7. Tear down the throwaway project (Supabase dashboard -> Settings ->
   delete project) so it doesn't linger as an unmonitored copy of
   production data.

Until the throwaway project exists, this remains a documented plan, not a
completed exercise.

## Related

- [deployment.md](./deployment.md), [rollback.md](./rollback.md).
- R6.5 account export (`GET /api/account/export`) is a per-user, on-demand data
  extract that complements (not replaces) managed backups.
