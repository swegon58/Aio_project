-- R11.1 — Per-tool spend sub-limits for #4 Code Execution and #5 Browser Automation.
-- Opens these tools to ALL pricing tiers while preventing cost overruns via dollar-based sub-limits.
-- Same accounting model as the global spend-cap (migration 0022): dollar-based, not per-tier run-counts.

-- Ponytail: Simple customer-scoped tool limits. No per-tier tables, no config UI this pass.
-- Default limits: $10 for code_execution, $20 for browser (defensible safety ceiling).
-- Upgrade path: Make these configurable via Settings UI when real usage patterns emerge.

create table if not exists aio_tool_sub_limits (
  customer_id uuid not null references auth.users (id) on delete cascade,
  tool_id text not null,
  limit_usd numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint aio_tool_sub_limits_pk primary key (customer_id, tool_id),
  constraint aio_tool_sub_limits_tool_id_chk check (
    tool_id in ('code_execution', 'browser')
  ),
  constraint aio_tool_sub_limits_limit_usd_chk check (limit_usd > 0)
);

-- Index for fast limit lookups during tool execution checks
create index if not exists aio_tool_sub_limits_customer_tool_idx
  on aio_tool_sub_limits (customer_id, tool_id);

-- RLS: customers can read their own limits, only service role can write
alter table aio_tool_sub_limits enable row level security;

create policy "Users can read own tool sub-limits"
  on aio_tool_sub_limits for select
  using (auth.uid() = customer_id);

-- Ponytail: No insert/update policies for users — Settings UI comes later.
-- Service role (RLS bypass) manages defaults and any manual adjustments.

-- Insert default limits for existing customers (backfill)
-- Ponytail: This runs once on migration apply; new customers get defaults via application logic.
insert into aio_tool_sub_limits (customer_id, tool_id, limit_usd)
  select 
    id as customer_id,
    'code_execution' as tool_id,
    10.0 as limit_usd
  from auth.users
  on conflict (customer_id, tool_id) do nothing;

insert into aio_tool_sub_limits (customer_id, tool_id, limit_usd)
  select 
    id as customer_id,
    'browser' as tool_id,
    20.0 as limit_usd
  from auth.users
  on conflict (customer_id, tool_id) do nothing;
