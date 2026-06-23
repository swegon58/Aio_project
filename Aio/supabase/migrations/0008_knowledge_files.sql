-- Aio x Hermes integration — RAG knowledge base (open-webui parity feature).
--
-- Per-customer document upload: file gets chunked + embedded via OpenRouter
-- (openai/text-embedding-3-small, 1536 dims — same per-customer key already
-- resolved in chat/route.ts's resolveOpenRouterKey). Chunks are retrieved by
-- cosine similarity at chat time and injected into the run's `instructions`
-- field alongside GUARDRAIL_SYSTEM_PROMPT (see chat/route.ts).

create extension if not exists vector;

create table if not exists hermes_knowledge_files (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  status text not null default 'processing', -- processing | ready | failed
  chunk_count int not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists hermes_knowledge_files_customer_id_idx
  on hermes_knowledge_files (customer_id, created_at desc);

create table if not exists hermes_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references hermes_knowledge_files (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null
);

create index if not exists hermes_knowledge_chunks_customer_id_idx
  on hermes_knowledge_chunks (customer_id);

-- Cosine-distance ANN index, scoped per customer via the partial-index-less
-- ivfflat default (filtering happens in the WHERE clause of match_knowledge_chunks).
create index if not exists hermes_knowledge_chunks_embedding_idx
  on hermes_knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table hermes_knowledge_files enable row level security;
alter table hermes_knowledge_chunks enable row level security;

-- Same trust boundary as hermes_conversations/hermes_gallery_images — Aio's
-- API routes use the service client exclusively.
create policy "Users can read own knowledge files"
  on hermes_knowledge_files for select
  using (auth.uid() = customer_id);

create policy "Users can read own knowledge chunks"
  on hermes_knowledge_chunks for select
  using (auth.uid() = customer_id);

-- Top-k cosine similarity search, scoped to one customer. SECURITY DEFINER
-- so the service-role caller doesn't need RLS bypass on every call site.
create or replace function match_knowledge_chunks(
  p_customer_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5
) returns table (
  id uuid,
  file_id uuid,
  content text,
  similarity float
) as $$
  select
    c.id,
    c.file_id,
    c.content,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from hermes_knowledge_chunks c
  where c.customer_id = p_customer_id
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$ language sql stable;
