-- Atomic webhook dedup + credit grant. Prior code did the dedup insert
-- (0021) and the credit adjustment (0003's hermes_adjust_credit_balance) as
-- two separate round-trips from webhook/route.ts — a crash between them
-- either double-credits on Paddle's retry or silently drops the credit
-- grant with no trace it ever happened. Single transaction closes that gap.
create or replace function hermes_process_webhook_credit(
  p_customer_id uuid,
  p_event_id text,
  p_event_type text,
  p_delta numeric,
  p_plan_tier text default null
) returns table(credited boolean, new_balance numeric) as $$
declare
  v_rows int;
  v_balance numeric;
begin
  insert into aio_paddle_webhook_events (paddle_event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (paddle_event_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- Redelivery of an already-processed event: no-op.
    return query select false, null::numeric;
    return;
  end if;

  if p_plan_tier is not null then
    update hermes_registry
    set plan_tier = p_plan_tier, credit_balance = credit_balance + p_delta
    where customer_id = p_customer_id
    returning credit_balance into v_balance;
  else
    update hermes_registry
    set credit_balance = credit_balance + p_delta
    where customer_id = p_customer_id
    returning credit_balance into v_balance;
  end if;

  if v_balance is null then
    raise exception 'hermes_registry row not found for customer %', p_customer_id;
  end if;

  return query select true, v_balance;
end;
$$ language plpgsql security definer;

revoke all on function hermes_process_webhook_credit(uuid, text, text, numeric, text) from public;
