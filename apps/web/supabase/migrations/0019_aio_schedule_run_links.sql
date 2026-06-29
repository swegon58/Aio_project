-- R5.4 follow-up: link durable schedule occurrences to the durable Aio run
-- they launch so worker retries can detect already-started executions.

alter table aio_schedule_runs
  add column if not exists aio_run_id uuid null references aio_runs (id) on delete set null;

create unique index if not exists aio_schedule_runs_aio_run_id_uniq
  on aio_schedule_runs (aio_run_id)
  where aio_run_id is not null;
