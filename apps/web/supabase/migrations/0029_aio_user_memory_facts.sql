-- R11.1: per-customer memory facts. Manual CRUD for user-curated facts about
-- themselves (e.g. "Lives in Hanoi"). Future auto-learn path will populate
-- source='auto'; all facts today are source='manual'.

create table if not exists aio_user_memory_facts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  value text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint aio_user_memory_facts_source_chk check (
    source in ('manual', 'auto')
  )
);

create index if not exists aio_user_memory_facts_customer_created_idx
  on aio_user_memory_facts (customer_id, created_at desc);

alter table aio_user_memory_facts enable row level security;

create policy "Users can read own memory facts"
  on aio_user_memory_facts for select
  using (auth.uid() = customer_id);

create policy "Users can insert own memory facts"
  on aio_user_memory_facts for insert
  with check (auth.uid() = customer_id);

create policy "Users can update own memory facts"
  on aio_user_memory_facts for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

create policy "Users can delete own memory facts"
  on aio_user_memory_facts for delete
  using (auth.uid() = customer_id);

-- Trigger to update updated_at on row modification
create or replace function aio_user_memory_facts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger aio_user_memory_facts_updated_at_trigger
  before update on aio_user_memory_facts
  for each row
  execute procedure aio_user_memory_facts_updated_at();