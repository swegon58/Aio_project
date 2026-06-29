-- R5.4: durable Aio-owned schedule definitions and schedule-run history.
-- Hermes-local cron files become compatibility state only; Aio owns the
-- product source of truth for scheduled tasks.

create table if not exists aio_schedules (
  id uuid primary key default gen_random_uuid(),
  aio_schedule_id text not null,
  customer_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  prompt text not null default '',
  schedule_text text not null,
  schedule_kind text not null,
  schedule_def jsonb not null,
  schedule_display text not null,
  enabled boolean not null default true,
  state text not null,
  paused_at timestamptz null,
  paused_reason text null,
  next_run_at timestamptz null,
  last_run_at timestamptz null,
  last_status text null,
  last_error_message_redacted text null,
  repeat_limit int null,
  repeat_completed int not null default 0,
  concurrency_policy text not null default 'forbid_overlap',
  catch_up_policy text not null default 'coalesce_once',
  task_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint aio_schedules_aio_schedule_id_uniq unique (aio_schedule_id),
  constraint aio_schedules_schedule_kind_chk check (
    schedule_kind in ('once', 'interval', 'cron')
  ),
  constraint aio_schedules_state_chk check (
    state in ('scheduled', 'paused', 'completed', 'error', 'cancelled')
  ),
  constraint aio_schedules_last_status_chk check (
    last_status is null
    or last_status in ('queued', 'running', 'completed', 'failed', 'skipped_overlap', 'cancelled')
  ),
  constraint aio_schedules_repeat_limit_chk check (
    repeat_limit is null or repeat_limit >= 1
  ),
  constraint aio_schedules_repeat_completed_chk check (repeat_completed >= 0),
  constraint aio_schedules_concurrency_policy_chk check (
    concurrency_policy in ('forbid_overlap')
  ),
  constraint aio_schedules_catch_up_policy_chk check (
    catch_up_policy in ('coalesce_once')
  ),
  constraint aio_schedules_schedule_def_obj_chk check (
    jsonb_typeof(schedule_def) = 'object'
  ),
  constraint aio_schedules_task_payload_obj_chk check (
    jsonb_typeof(task_payload) = 'object'
  )
);

create index if not exists aio_schedules_customer_created_idx
  on aio_schedules (customer_id, created_at desc);

create index if not exists aio_schedules_customer_state_next_run_idx
  on aio_schedules (customer_id, state, next_run_at asc);

create index if not exists aio_schedules_due_idx
  on aio_schedules (next_run_at asc)
  where enabled = true and state = 'scheduled' and next_run_at is not null;

alter table aio_schedules enable row level security;

create policy "Users can read own schedules"
  on aio_schedules for select
  using (auth.uid() = customer_id);

create table if not exists aio_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  aio_schedule_run_id text not null,
  schedule_id uuid not null references aio_schedules (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  occurrence_key text not null,
  trigger_kind text not null,
  status text not null,
  occurrence_at timestamptz not null,
  aio_job_id text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  error_code text null,
  error_message_redacted text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint aio_schedule_runs_aio_schedule_run_id_uniq unique (aio_schedule_run_id),
  constraint aio_schedule_runs_schedule_occurrence_uniq unique (schedule_id, occurrence_key),
  constraint aio_schedule_runs_aio_job_id_uniq unique (aio_job_id),
  constraint aio_schedule_runs_trigger_kind_chk check (
    trigger_kind in ('scheduled', 'manual', 'catch_up')
  ),
  constraint aio_schedule_runs_status_chk check (
    status in ('queued', 'running', 'completed', 'failed', 'skipped_overlap', 'cancelled')
  )
);

create index if not exists aio_schedule_runs_schedule_created_idx
  on aio_schedule_runs (schedule_id, created_at asc);

create index if not exists aio_schedule_runs_customer_occurrence_idx
  on aio_schedule_runs (customer_id, occurrence_at desc);

alter table aio_schedule_runs enable row level security;

create policy "Users can read own schedule runs"
  on aio_schedule_runs for select
  using (auth.uid() = customer_id);
