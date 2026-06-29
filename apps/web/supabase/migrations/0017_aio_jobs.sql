-- R5.3: durable Aio queue jobs and lease-claim helpers.
-- Postgres is the queue source of truth; workers claim through RPC helpers so
-- lease races stay server-side.

create table if not exists aio_jobs (
  id uuid primary key default gen_random_uuid(),
  aio_job_id text not null,
  schema_version int not null,
  job_type text not null,
  status text not null,
  customer_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid null references aio_runs (id) on delete cascade,
  conversation_id uuid null,
  thread_id text null,
  idempotency_key text not null,
  attempt int not null default 0,
  max_attempts int not null default 3,
  scheduled_for timestamptz not null default now(),
  deadline_at timestamptz null,
  payload_ref jsonb null,
  lease_owner text null,
  lease_token uuid null,
  lease_expires_at timestamptz null,
  last_heartbeat_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  last_error_code text null,
  last_error_message_redacted text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint aio_jobs_aio_job_id_uniq unique (aio_job_id),
  constraint aio_jobs_idempotency_key_uniq unique (idempotency_key),
  constraint aio_jobs_schema_version_chk check (schema_version >= 1),
  constraint aio_jobs_status_chk check (
    status in (
      'queued',
      'claimed',
      'running',
      'retrying',
      'completed',
      'cancelled',
      'dead_lettered',
      'failed'
    )
  ),
  constraint aio_jobs_attempt_chk check (attempt >= 0),
  constraint aio_jobs_max_attempts_chk check (max_attempts >= 1),
  constraint aio_jobs_payload_ref_obj_chk check (
    payload_ref is null or jsonb_typeof(payload_ref) = 'object'
  )
);

create index if not exists aio_jobs_status_scheduled_idx
  on aio_jobs (status, scheduled_for asc, created_at asc);

create index if not exists aio_jobs_customer_status_idx
  on aio_jobs (customer_id, status, scheduled_for desc);

create index if not exists aio_jobs_run_created_idx
  on aio_jobs (run_id, created_at asc)
  where run_id is not null;

create index if not exists aio_jobs_lease_expiry_idx
  on aio_jobs (lease_expires_at asc)
  where status in ('claimed', 'running');

alter table aio_jobs enable row level security;

create policy "Users can read own jobs"
  on aio_jobs for select
  using (auth.uid() = customer_id);

create or replace function aio_release_due_retrying_jobs(
  p_now timestamptz default now()
) returns int
language plpgsql
set search_path = public
as $$
declare
  v_count int := 0;
begin
  update aio_jobs
     set status = 'queued',
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         last_heartbeat_at = null,
         updated_at = p_now
   where status = 'retrying'
     and scheduled_for <= p_now;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function aio_requeue_expired_job_leases(
  p_now timestamptz default now(),
  p_retry_delay_seconds int default 30
) returns int
language plpgsql
set search_path = public
as $$
declare
  v_count int := 0;
begin
  update aio_jobs
     set status = case
           when status = 'claimed' then 'queued'
           else 'retrying'
         end,
         scheduled_for = case
           when status = 'claimed' then p_now
           else p_now + make_interval(secs => greatest(p_retry_delay_seconds, 1))
         end,
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         last_heartbeat_at = null,
         last_error_code = coalesce(last_error_code, 'LEASE_EXPIRED'),
         last_error_message_redacted = coalesce(
           last_error_message_redacted,
           'Worker lease expired before job completion.'
         ),
         updated_at = p_now
   where status in ('claimed', 'running')
     and lease_expires_at is not null
     and lease_expires_at < p_now;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function aio_claim_next_job(
  p_worker_id text,
  p_lease_seconds int default 60,
  p_job_types text[] default null,
  p_now timestamptz default now()
) returns table (
  id uuid,
  aio_job_id text,
  schema_version int,
  job_type text,
  status text,
  customer_id uuid,
  run_id uuid,
  conversation_id uuid,
  thread_id text,
  idempotency_key text,
  attempt int,
  max_attempts int,
  scheduled_for timestamptz,
  deadline_at timestamptz,
  payload_ref jsonb,
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message_redacted text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
set search_path = public
as $$
begin
  return query
  with candidate as (
    select j.id
      from aio_jobs j
     where j.status = 'queued'
       and j.scheduled_for <= p_now
       and (p_job_types is null or j.job_type = any (p_job_types))
     order by j.scheduled_for asc, j.created_at asc
     for update skip locked
     limit 1
  ),
  claimed as (
    update aio_jobs j
       set status = 'claimed',
           lease_owner = p_worker_id,
           lease_token = gen_random_uuid(),
           lease_expires_at = p_now + make_interval(secs => greatest(p_lease_seconds, 15)),
           last_heartbeat_at = p_now,
           updated_at = p_now
      from candidate c
     where j.id = c.id
     returning j.*
  )
  select * from claimed;
end;
$$;
