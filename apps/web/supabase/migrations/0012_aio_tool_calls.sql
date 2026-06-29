-- Aio R2.2 — durable tool-call lifecycle rows.
-- Each row snapshots the manifest/risk/approval policy in effect when the
-- tool call was proposed, so later approval and audit records do not depend on
-- mutable runtime config.

create table if not exists aio_tool_calls (
  id uuid primary key default gen_random_uuid(),
  aio_tool_call_id text not null,
  hermes_tool_call_id text null,
  run_id uuid not null references aio_runs (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  tool_name text not null,
  tool_label text null,
  manifest_version int not null,
  status text not null,
  redacted_input jsonb null,
  redacted_output jsonb null,
  risk text not null,
  approval_policy jsonb not null default '{}'::jsonb,
  attempts int not null default 1,
  timeout_ms int not null,
  error_code text null,
  error_message_redacted text null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,

  constraint aio_tool_calls_aio_tool_call_id_uniq unique (aio_tool_call_id),
  constraint aio_tool_calls_idempotency_key_uniq unique (idempotency_key),
  constraint aio_tool_calls_status_chk check (
    status in (
      'proposed',
      'waiting_approval',
      'approved',
      'running',
      'completed',
      'denied',
      'expired',
      'cancelled',
      'failed',
      'timed_out'
    )
  ),
  constraint aio_tool_calls_risk_chk check (risk in ('safe', 'guarded', 'dangerous')),
  constraint aio_tool_calls_manifest_version_chk check (manifest_version >= 1),
  constraint aio_tool_calls_attempts_chk check (attempts >= 1),
  constraint aio_tool_calls_timeout_chk check (timeout_ms > 0),
  constraint aio_tool_calls_approval_policy_obj_chk check (
    jsonb_typeof(approval_policy) = 'object'
  )
);

create unique index if not exists aio_tool_calls_run_hermes_tool_call_id_uniq
  on aio_tool_calls (run_id, hermes_tool_call_id)
  where hermes_tool_call_id is not null;

create index if not exists aio_tool_calls_run_created_idx
  on aio_tool_calls (run_id, created_at asc);

create index if not exists aio_tool_calls_customer_status_updated_idx
  on aio_tool_calls (customer_id, status, updated_at desc);

alter table aio_tool_calls enable row level security;

create policy "Users can read own tool calls"
  on aio_tool_calls for select
  using (auth.uid() = customer_id);
