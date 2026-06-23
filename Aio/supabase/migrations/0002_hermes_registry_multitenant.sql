-- Aio x Hermes integration — multi-tenant registry fixes (Step 3b)
-- Problem: 0001 made profile_name/port/normalized_email globally unique with NOT NULL,
-- which is correct for distinct provisioned profiles, but blocked the lazy-provisioning
-- flow (BUILD_SPEC §4): a row must exist (status='provisioned') BEFORE a profile/port
-- is assigned, and normalized_email collisions must be enforceable per Q30 without
-- breaking inserts for rows that haven't been provisioned yet.

-- 1. Allow profile_name/port to be NULL until provisioning assigns them.
alter table hermes_registry alter column profile_name drop not null;
alter table hermes_registry alter column port drop not null;
alter table hermes_registry alter column endpoint drop not null;
alter table hermes_registry alter column api_server_key_ref drop not null;
alter table hermes_registry alter column commit_pin drop not null;

-- 2. Partial unique indexes: uniqueness only applies once a value is assigned.
-- (NULLs are never considered equal by a plain UNIQUE constraint, but a partial
-- index makes the intent explicit and lets us drop the old blanket constraints.)
alter table hermes_registry drop constraint if exists hermes_registry_profile_name_key;
alter table hermes_registry drop constraint if exists hermes_registry_port_key;

create unique index if not exists hermes_registry_profile_name_uniq
  on hermes_registry (profile_name) where profile_name is not null;

create unique index if not exists hermes_registry_port_uniq
  on hermes_registry (port) where port is not null;

-- 3. process tracking columns for idle-kill / respawn / crash-reconcile (Q14, Q39).
alter table hermes_registry add column if not exists pid integer;
alter table hermes_registry add column if not exists last_active_at timestamptz not null default now();

-- 4. 'failed' status for crash-reconcile (Q39).
alter table hermes_registry drop constraint if exists hermes_registry_status_check;
alter table hermes_registry add constraint hermes_registry_status_check
  check (status in ('provisioned', 'running', 'idle', 'stopped', 'failed'));

-- 5. hermes_threads: map (customer_id, thread_id) -> Hermes Session-Id (BUILD_SPEC §6, §12 step 2).
-- 0001 created a bare session_id-keyed table with no client-facing thread_id; add one
-- so the same logical chat thread always maps to the same Hermes Session-Id.
alter table hermes_threads add column if not exists thread_id text not null default gen_random_uuid()::text;

create unique index if not exists hermes_threads_customer_thread_uniq
  on hermes_threads (customer_id, thread_id);
