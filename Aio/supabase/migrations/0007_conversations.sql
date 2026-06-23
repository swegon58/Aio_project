-- Aio x Hermes integration — persisted chat history (new chat + sidebar list)
--
-- One row per chat thread. `id` is the same uuid as the `hermes_thread_id`
-- cookie (request-context.ts THREAD_COOKIE), so chat/route.ts can upsert
-- directly by cookie value with no extra lookup. `messages` stores the full
-- Vercel AI SDK UIMessage[] array as-is (parts included) so the client can
-- reload a past thread straight into useChat's `messages` state.

create table if not exists hermes_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hermes_conversations_customer_id_idx
  on hermes_conversations (customer_id, updated_at desc);

alter table hermes_conversations enable row level security;

-- Same trust boundary as hermes_gallery_images/hermes_registry — Aio's API
-- routes use the service client exclusively. Explicit policy covers any
-- future client-side read.
create policy "Users can read own conversations"
  on hermes_conversations for select
  using (auth.uid() = customer_id);
