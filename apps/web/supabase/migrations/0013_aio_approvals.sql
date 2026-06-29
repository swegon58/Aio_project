-- Aio R2.3 — durable approval lifecycle rows.
-- Each row captures a user-approval request for a sensitive tool call and its
-- resolution, so approvals survive run crashes and can be replayed, audited,
-- and enforced (R2.5). Mirrors the aio_tool_calls shape.

create table if not exists aio_approvals (
  id uuid primary key default gen_random_uuid(),
  aio_approval_id text not null,
  run_id uuid not null references aio_runs (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  aio_tool_call_id text null,
  tool_name text null,
  tool_label text null,
  risk text not null,
  approval_mode text not null,
  status text not null,
  title text null,
  requested_input_redacted jsonb null,
  resolution text null,
  resolved_by uuid null references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz null,
  expires_at timestamptz not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint aio_approvals_aio_approval_id_uniq unique (aio_approval_id),
  constraint aio_approvals_idempotency_key_uniq unique (idempotency_key),
  constraint aio_approvals_status_chk check (
    status in ('requested', 'approved', 'rejected', 'expired', 'cancelled')
  ),
  constraint aio_approvals_risk_chk check (risk in ('safe', 'guarded', 'dangerous')),
  constraint aio_approvals_mode_chk check (approval_mode in ('none', 'once', 'session')),
  constraint aio_approvals_resolution_chk check (
    resolution in ('approve', 'reject', 'edit')
  )
);

create index if not exists aio_approvals_run_created_idx
  on aio_approvals (run_id, created_at asc);

create index if not exists aio_approvals_customer_status_updated_idx
  on aio_approvals (customer_id, status, updated_at desc);

create index if not exists aio_approvals_tool_call_idx
  on aio_approvals (aio_tool_call_id)
  where aio_tool_call_id is not null;

alter table aio_approvals enable row level security;

create policy "Users can read own approvals"
  on aio_approvals for select
  using (auth.uid() = customer_id);
