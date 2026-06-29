-- Aio R1 — durable run foundation: the ordered, idempotent event log for a run.
-- Each row is one persisted V1 envelope (see aio-run-event-envelope.ts). This
-- table is the replay source of truth (ADR-001 §5): Aio replays from Postgres,
-- never from Hermes. Per ADR-001 §4:
--   * sequence is monotonic per run, assigned by the repository at append time;
--     (run_id, sequence) is unique.
--   * envelope id is globally unique (the primary key).
--   * reprocessing the same Hermes event yields the same payload/id, so replay
--     is idempotent and the repository can dedupe on envelope id.
--
-- `customer_id` is denormalized onto each event row so RLS can enforce tenant
-- isolation without a join (same trust boundary as aio_runs). The repository
-- stamps it from the parent run at append time; the browser cannot insert.

create table if not exists aio_run_events (
  id uuid primary key default gen_random_uuid(),
  schema_version int not null,
  run_id uuid not null references aio_runs (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  sequence int not null,
  type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  source text not null,
  payload jsonb not null,
  hermes jsonb null,

  constraint aio_run_events_schema_version_chk check (schema_version = 1),
  constraint aio_run_events_sequence_chk check (sequence >= 0),
  constraint aio_run_events_source_chk check (source in ('aio', 'hermes', 'worker'))
);

-- Monotonic per-run order; also serves the replay query
-- (where run_id = $1 and sequence > $2 order by sequence).
create unique index if not exists aio_run_events_run_sequence_uniq
  on aio_run_events (run_id, sequence);

create index if not exists aio_run_events_run_occurred_idx
  on aio_run_events (run_id, occurred_at);

create index if not exists aio_run_events_customer_created_idx
  on aio_run_events (customer_id, received_at desc);

alter table aio_run_events enable row level security;

-- Users may read events for their own runs. No insert/update/delete policies
-- for anon/authenticated: only the service role can append through the
-- repository, so the browser can never forge or mutate an event.
create policy "Users can read own run events"
  on aio_run_events for select
  using (auth.uid() = customer_id);
