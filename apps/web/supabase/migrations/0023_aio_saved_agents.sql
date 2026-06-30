-- R7 Saved Agents: user-owned reusable instruction bundles. Additive only —
-- instructions_addition is appended after GUARDRAIL_SYSTEM_PROMPT, never
-- replaces it. No tool/model override columns (see
-- docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md for why those are deferred).
create table if not exists aio_saved_agents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  instructions_addition text not null default '',
  use_knowledge boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aio_saved_agents_customer_id_idx
  on aio_saved_agents (customer_id);

alter table aio_saved_agents enable row level security;

-- Direct table access stays service-role only (same trust boundary as
-- hermes_gallery_images/hermes_knowledge_files — all reads/writes go
-- through Aio's API routes using the service client). RLS is enabled with
-- no write policies, which denies all access to anon/authenticated by
-- default; explicit select policy below covers a future client-side read.
create policy "Users can read own saved agents"
  on aio_saved_agents for select
  using (auth.uid() = customer_id);
