-- Aio x Hermes integration — registry schema (BUILD_SPEC.md §6)
-- Phase 1: schema-as-code, no live Supabase project yet. Apply via `supabase db push` once provisioned.

create table if not exists hermes_registry (
  customer_id uuid primary key references auth.users (id) on delete cascade,
  profile_name text not null unique,
  port integer not null unique,
  endpoint text not null,
  status text not null default 'provisioned'
    check (status in ('provisioned', 'running', 'idle', 'stopped')),
  api_server_key_ref text not null, -- Supabase Vault pointer, NOT the raw key (Q11/Q41)
  commit_pin text not null,
  credit_balance numeric not null default 0,
  plan_tier text not null default 'starter'
    check (plan_tier in ('starter', 'pro', 'business')),
  free_grant_used boolean not null default false,
  normalized_email text not null unique, -- Q30: strip "+tag" and dots for Sybil dedup
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hermes_registry_status_idx on hermes_registry (status);
create index if not exists hermes_registry_normalized_email_idx on hermes_registry (normalized_email);

-- Thread registry: chat thread -> Hermes Session-Id mapping (BUILD_SPEC.md §6, §12 step 2)
create table if not exists hermes_threads (
  session_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists hermes_threads_customer_id_idx on hermes_threads (customer_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger hermes_registry_set_updated_at
  before update on hermes_registry
  for each row
  execute function set_updated_at();

alter table hermes_registry enable row level security;
alter table hermes_threads enable row level security;

create policy "Users can read own registry row"
  on hermes_registry for select
  using (auth.uid() = customer_id);

create policy "Users can manage own threads"
  on hermes_threads for all
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);
