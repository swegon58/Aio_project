-- R10.2: proactive notifications. In-app notification feed for scheduled-task
-- and research-run completions, plus the per-schedule Discord delivery flag.

create table if not exists aio_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  title text not null,
  body text null,
  read_at timestamptz null,
  created_at timestamptz not null default now(),

  constraint aio_notifications_source_chk check (
    source in ('scheduled_task', 'research_run')
  )
);

create index if not exists aio_notifications_customer_created_idx
  on aio_notifications (customer_id, created_at desc);

create index if not exists aio_notifications_customer_unread_idx
  on aio_notifications (customer_id, created_at desc)
  where read_at is null;

alter table aio_notifications enable row level security;

create policy "Users can read own notifications"
  on aio_notifications for select
  using (auth.uid() = customer_id);

create policy "Users can update own notifications"
  on aio_notifications for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

alter table aio_schedules
  add column if not exists notify_discord boolean not null default false;
