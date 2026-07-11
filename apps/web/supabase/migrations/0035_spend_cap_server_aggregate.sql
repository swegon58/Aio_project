-- R6.8/R11.1 spend-cap lookups (src/lib/aio/billing/spend-cap.ts) pulled every
-- completed aio_runs row for a customer and summed in JS — unbounded full-
-- history scan on every cap check. Move the SUM() into Postgres.
create or replace function hermes_sum_completed_credits(
  p_customer_id uuid
) returns numeric as $$
  select coalesce(sum(actual_credits), 0)
  from aio_runs
  where customer_id = p_customer_id and status = 'completed';
$$ language sql security definer stable;

revoke all on function hermes_sum_completed_credits(uuid) from public;

create or replace function hermes_sum_tool_credits(
  p_customer_id uuid,
  p_tool_id text
) returns numeric as $$
  select coalesce(sum(r.actual_credits), 0)
  from aio_runs r
  where r.customer_id = p_customer_id
    and r.status = 'completed'
    and r.id in (
      select tc.run_id from aio_tool_calls tc
      where tc.customer_id = p_customer_id and tc.tool_name = p_tool_id
    );
$$ language sql security definer stable;

revoke all on function hermes_sum_tool_credits(uuid, text) from public;
