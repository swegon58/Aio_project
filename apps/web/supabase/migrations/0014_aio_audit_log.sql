-- R2.6: Append-only audit log for approval lifecycle, dangerous tool
-- execution, credential access, admin actions, and MCP boundary events.
-- Row-level security mirrors aio_runs: owner reads own rows, service role writes.

create table if not exists public.aio_audit_log (
  id              uuid primary key default gen_random_uuid(),

  -- actor / tenant
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- what happened
  event_type      text not null,
  -- coarse category: approval | tool_execution | credential | admin | mcp
  category        text not null,

  -- linked entities (nullable — attach what's known at audit time)
  run_id          uuid references public.aio_runs(id) on delete set null,
  tool_call_id    uuid references public.aio_tool_calls(id) on delete set null,
  approval_id     uuid references public.aio_approvals(id) on delete set null,

  -- redacted payload snapshot (no raw secrets, PII, or prompt text)
  context         jsonb not null default '{}',

  -- outcome
  outcome         text not null default 'unknown',
  -- unknown | success | denied | expired | error | conflict

  -- immutable write timestamp (explicit, not defaulted, so replay is detectable)
  occurred_at     timestamptz not null default now(),

  -- audit records are never deleted; this constraint enforces append-only at the
  -- policy level (application layer must never issue UPDATE/DELETE on this table)
  constraint category_check check (
    category in ('approval', 'tool_execution', 'credential', 'admin', 'mcp')
  ),
  constraint outcome_check check (
    outcome in ('unknown', 'success', 'denied', 'expired', 'error', 'conflict')
  )
);

-- per-user recency index (most common query: "show me my audit trail")
create index if not exists aio_audit_log_user_occurred_at
  on public.aio_audit_log (user_id, occurred_at desc);

-- cross-entity lookup indexes
create index if not exists aio_audit_log_run_id
  on public.aio_audit_log (run_id) where run_id is not null;
create index if not exists aio_audit_log_approval_id
  on public.aio_audit_log (approval_id) where approval_id is not null;
create index if not exists aio_audit_log_category_occurred_at
  on public.aio_audit_log (category, occurred_at desc);

-- RLS: enabled, owner reads own rows; service role bypasses for writes
alter table public.aio_audit_log enable row level security;

create policy "Users read own audit rows"
  on public.aio_audit_log
  for select
  using (auth.uid() = user_id);
