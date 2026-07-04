-- R11.1: per-customer preferences. User settings for notifications and data training.

create table if not exists aio_user_preferences (
  customer_id uuid primary key references auth.users (id) on delete cascade,
  notify_discord_global boolean not null default true,
  data_training_opt_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table aio_user_preferences enable row level security;

create policy "Users can read own preferences"
  on aio_user_preferences for select
  using (auth.uid() = customer_id);

create policy "Users can insert own preferences"
  on aio_user_preferences for insert
  with check (auth.uid() = customer_id);

create policy "Users can update own preferences"
  on aio_user_preferences for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

-- Trigger to update updated_at on row modification
create or replace function aio_user_preferences_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger aio_user_preferences_updated_at_trigger
  before update on aio_user_preferences
  for each row
  execute procedure aio_user_preferences_updated_at();