-- Aio R1.4 — atomic, idempotent event append.
-- The Supabase JS client has no client-side transactions, and the next
-- monotonic sequence for a run must be assigned *and* the row inserted in one
-- step to stay race-free under concurrent appends (ADR-001 §4). This function
-- does both, and dedupes on envelope id so reprocessing the same Hermes event
-- is a safe no-op.
--
-- Idempotency key = the envelope `id`. The R1.2 mapper derives a deterministic
-- envelope id from stable Hermes fields (tool_call_id / scriptPath / event id),
-- so replaying the same stream yields the same ids. Aio-native events without a
-- Hermes source use a producer-supplied id.
--
-- SECURITY INVOKER: only the service-role repository (RLS-bypassing) calls this.
-- Returns exactly one row: (id, sequence, inserted, conflict).
--   inserted = true  -> a new row was persisted with this sequence.
--   inserted = false, conflict = 'duplicate_id' -> idempotent no-op (same id).
--   inserted = false, conflict = 'sequence_race' -> lost a (run_id, sequence)
--                  race to a different envelope; the caller retries.

create or replace function aio_append_run_event(
  p_id uuid,
  p_schema_version int,
  p_run_id uuid,
  p_customer_id uuid,
  p_type text,
  p_occurred_at timestamptz,
  p_received_at timestamptz,
  p_source text,
  p_payload jsonb,
  p_hermes jsonb default null
) returns table (
  out_id uuid,
  out_sequence int,
  out_inserted boolean,
  out_conflict text
)
language plpgsql
set search_path = public
as $$
declare
  v_seq int;
begin
  -- Fast path: this exact envelope already exists -> no-op (replay / reprocess).
  select e.sequence into v_seq
    from aio_run_events e
   where e.id = p_id;
  if found then
    return query select p_id, v_seq, false, 'duplicate_id'::text;
    return;
  end if;

  -- Next monotonic sequence for this run (0-based, assigned at append time).
  select coalesce(max(e.sequence), -1) + 1 into v_seq
    from aio_run_events e
   where e.run_id = p_run_id;

  begin
    insert into aio_run_events (
      id, schema_version, run_id, customer_id, sequence, type,
      occurred_at, received_at, source, payload, hermes
    ) values (
      p_id, p_schema_version, p_run_id, p_customer_id, v_seq, p_type,
      p_occurred_at, p_received_at, p_source, p_payload, p_hermes
    );
  exception
    when unique_violation then
      -- Concurrent append raced on (run_id, sequence) or on id. Resolve:
      -- if the envelope id now exists it is a clean dedupe; otherwise a
      -- different envelope won the sequence and the caller must retry.
      select e.sequence into v_seq
        from aio_run_events e
       where e.id = p_id;
      if found then
        return query select p_id, v_seq, false, 'duplicate_id'::text;
      else
        return query select p_id, null::int, false, 'sequence_race'::text;
      end if;
      return;
  end;

  return query select p_id, v_seq, true, ''::text;
end;
$$;
