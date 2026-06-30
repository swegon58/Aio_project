-- R6.3: Paddle webhook idempotency. Paddle redelivers webhooks on non-2xx
-- responses; without a dedup guard a redelivered transaction.completed event
-- double-credits the customer. The unique constraint on paddle_event_id is
-- the guard: the webhook route inserts before crediting and skips processing
-- on conflict. Service-role only, no customer-facing access needed.
create table if not exists aio_paddle_webhook_events (
  id uuid primary key default gen_random_uuid(),
  paddle_event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),

  constraint aio_paddle_webhook_events_event_id_uniq unique (paddle_event_id)
);

alter table aio_paddle_webhook_events enable row level security;
