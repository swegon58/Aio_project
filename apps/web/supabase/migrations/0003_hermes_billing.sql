-- Aio x Hermes integration — billing/credits support (Step 4, BUILD_SPEC §7)

-- Atomic credit balance adjustment (reserve / refund / settle). Returns the
-- new balance. Used by src/lib/hermes/billing.ts. Allows the balance to go
-- negative transiently (e.g. concurrent reservations) — Phase 1 accepts this
-- edge case; per-task caps (Q17) bound how negative it can realistically get.
create or replace function hermes_adjust_credit_balance(
  p_customer_id uuid,
  p_delta numeric
) returns numeric as $$
declare
  v_balance numeric;
begin
  update hermes_registry
  set credit_balance = credit_balance + p_delta
  where customer_id = p_customer_id
  returning credit_balance into v_balance;

  if v_balance is null then
    raise exception 'hermes_registry row not found for customer %', p_customer_id;
  end if;

  return v_balance;
end;
$$ language plpgsql security definer;

-- service-role only (no grant to anon/authenticated) — called via the
-- Supabase service client from Aio's gateway, never client-side.
revoke all on function hermes_adjust_credit_balance(uuid, numeric) from public;
