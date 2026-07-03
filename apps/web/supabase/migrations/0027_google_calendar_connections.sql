-- R10.1: Google Calendar connect flow. Non-secret connection state; the
-- OAuth refresh/access tokens themselves live in the existing per-customer
-- credential vault (hermes_credential_refs / vault_store_credential,
-- migration 0006) under key_name 'google_calendar_token'.

create table if not exists google_calendar_connections (
  customer_id uuid primary key references auth.users (id) on delete cascade,
  google_email text not null,
  granted_scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  revoked_at timestamptz null,
  last_used_at timestamptz null
);

alter table google_calendar_connections enable row level security;
-- No policies — service-role only, same trust boundary as hermes_credential_refs
-- and hermes_registry.
