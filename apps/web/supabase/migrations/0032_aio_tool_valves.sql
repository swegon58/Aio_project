-- R12: per-customer tool "valves" (runtime-tunable knobs keyed by tool_id).
-- The first consumer is knowledge_retrieval's bm25_weight / match_count,
-- but the table is generic: any tool may read its own knobs via getToolValves.

create table if not exists aio_tool_valves (
  customer_id uuid not null references auth.users (id) on delete cascade,
  tool_id text not null,
  valves jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (customer_id, tool_id)
);

alter table aio_tool_valves enable row level security;

create policy "Users can read own tool valves"
  on aio_tool_valves for select
  using (auth.uid() = customer_id);

create policy "Users can insert own tool valves"
  on aio_tool_valves for insert
  with check (auth.uid() = customer_id);

create policy "Users can update own tool valves"
  on aio_tool_valves for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

-- Trigger to update updated_at on row modification (mirrors 0028 pattern).
create or replace function aio_tool_valves_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger aio_tool_valves_updated_at_trigger
  before update on aio_tool_valves
  for each row
  execute procedure aio_tool_valves_updated_at();
