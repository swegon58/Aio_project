-- R13 P0: lease/heartbeat/sweep mechanism for aio_runs, mirroring the
-- existing aio_jobs pattern (0017_aio_jobs.sql: lease_expires_at,
-- heartbeatJobLease, aio_requeue_expired_job_leases) so a crashed
-- server/process no longer leaves a run stuck `running` or `cancelling`
-- forever with nothing to reconcile it.
--
-- Unlike jobs, a run is not requeued/retried on lease expiry — it is a
-- single user-initiated live process, not a repeatable unit of work. The
-- sweep instead closes it to the terminal state each status already allows
-- (see run-state-machine.ts): `running` -> `failed`, `cancelling` ->
-- `cancelled`. `queued` and `waiting_approval` are not lease-holding states
-- (no active worker heartbeat is expected there) and are left untouched.

alter table aio_runs
  add column if not exists lease_owner text null,
  add column if not exists lease_token uuid null,
  add column if not exists lease_expires_at timestamptz null,
  add column if not exists last_heartbeat_at timestamptz null;

create index if not exists aio_runs_lease_expiry_idx
  on aio_runs (lease_expires_at asc)
  where status in ('running', 'cancelling');

create or replace function aio_sweep_expired_run_leases(
  p_now timestamptz default now()
) returns int
language plpgsql
set search_path = public
as $$
declare
  v_count int := 0;
begin
  update aio_runs
     set status = case when status = 'cancelling' then 'cancelled' else 'failed' end,
         completed_at = p_now,
         error_code = coalesce(error_code, 'LEASE_EXPIRED'),
         error_message_redacted = coalesce(
           error_message_redacted,
           'Run lease expired without a heartbeat; closed by the sweep.'
         ),
         lease_owner = null,
         lease_token = null,
         lease_expires_at = null,
         last_heartbeat_at = null,
         updated_at = p_now
   where status in ('running', 'cancelling')
     and lease_expires_at is not null
     and lease_expires_at < p_now;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
