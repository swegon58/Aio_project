-- Aio R1 — durable run foundation: one row per Aio "run" (a chat turn, a Deep
-- Research query, an image creation). This is the durable source of truth for a
-- run's lifecycle. Per ADR-001:
--   * Aio owns the run identity (uuid, created before the Hermes call).
--   * Hermes identifiers are adapter metadata, never the product identity.
--   * status is the machine in ADR-001 §3, including the transient `cancelling`.
--   * aio_runs.status is the source of truth; the status embedded in events is
--     only an informational projection.
--
-- NOTE on column naming: every existing multi-tenant table (hermes_registry,
-- hermes_conversations, hermes_gallery_images, ...) and every query in the app
-- key the owner off `customer_id` -> auth.users(id). aio_runs follows that same
-- convention (the R1 checklist draft said `user_id`; corrected here for schema
-- consistency so the R1.4 repositories can join and enforce RLS uniformly).

create table if not exists aio_runs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid null references hermes_conversations (id) on delete set null,
  thread_id text not null,
  status text not null,
  mode text not null,
  input_summary text,
  hermes_run_id text null,
  hermes_session_id text null,
  reserved_credits numeric null,
  actual_credits numeric null,
  error_code text null,
  error_message_redacted text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  cancel_requested_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,

  constraint aio_runs_status_chk check (
    status in ('queued', 'running', 'waiting_approval', 'cancelling', 'completed', 'failed', 'cancelled')
  ),
  -- Bound metadata so a run row stays cheap to store/replay. Product event
  -- payloads (the larger surface) live in aio_run_events and are redacted by
  -- the mapper/repository before persist (ADR-001 retention rule).
  constraint aio_runs_metadata_size_chk check (pg_column_size(metadata) < 65536)
);

create index if not exists aio_runs_customer_created_idx
  on aio_runs (customer_id, created_at desc);

create index if not exists aio_runs_customer_status_updated_idx
  on aio_runs (customer_id, status, updated_at desc);

create index if not exists aio_runs_customer_thread_idx
  on aio_runs (customer_id, thread_id);

create index if not exists aio_runs_conversation_idx
  on aio_runs (conversation_id)
  where conversation_id is not null;

-- One Aio run maps to one Hermes run (ADR-001 §2). Enforce uniqueness of the
-- adapter mapping only when present, so pre-start (queued) runs can coexist.
create unique index if not exists aio_runs_hermes_run_id_uniq
  on aio_runs (hermes_run_id)
  where hermes_run_id is not null;

alter table aio_runs enable row level security;

-- Users may read their own runs. The browser never inserts or mutates a run
-- row: there are no insert/update/delete policies for anon/authenticated, so
-- only the service role (RLS-bypassing) can write through the R1.4 repository.
create policy "Users can read own runs"
  on aio_runs for select
  using (auth.uid() = customer_id);
