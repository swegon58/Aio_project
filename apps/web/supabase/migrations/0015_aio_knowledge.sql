-- R4.2a: Knowledge Center — document store, chunk table with pgvector index.
-- Enable pgvector before applying: CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge documents (one per upload)
CREATE TABLE IF NOT EXISTS aio_knowledge_docs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  mime_type     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,   -- Supabase Storage object path
  status        TEXT NOT NULL DEFAULT 'uploaded'
                CHECK (status IN ('uploaded','parsing','chunking','embedding','ready','error')),
  error_message TEXT,
  chunk_count   INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE aio_knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own docs"
  ON aio_knowledge_docs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own docs"
  ON aio_knowledge_docs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own docs"
  ON aio_knowledge_docs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own docs"
  ON aio_knowledge_docs FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_knowledge_docs_user ON aio_knowledge_docs(user_id, created_at DESC);
CREATE INDEX idx_knowledge_docs_status ON aio_knowledge_docs(user_id, status);

-- Knowledge chunks (embedded text fragments from docs)
CREATE TABLE IF NOT EXISTS aio_knowledge_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_id      UUID NOT NULL REFERENCES aio_knowledge_docs(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  token_count INT,
  embedding   vector(1536),    -- text-embedding-ada-002 / ada-v3-small
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE aio_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own chunks"
  ON aio_knowledge_chunks FOR SELECT
  USING (auth.uid() = user_id);

-- Cosine similarity index (ivfflat — use hnsw on pg >= 16 for better recall)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON aio_knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_knowledge_chunks_doc ON aio_knowledge_chunks(doc_id);
CREATE INDEX idx_knowledge_chunks_user ON aio_knowledge_chunks(user_id);

-- Vector similarity search function (tenant-scoped, no cross-user leakage)
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  p_user_id   UUID,
  p_embedding vector(1536),
  p_match_k   INT DEFAULT 8,
  p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id          UUID,
  doc_id      UUID,
  chunk_index INT,
  content     TEXT,
  similarity  FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.doc_id,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> p_embedding) AS similarity
  FROM aio_knowledge_chunks c
  WHERE c.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> p_embedding) >= p_threshold
  ORDER BY c.embedding <=> p_embedding
  LIMIT p_match_k;
END;
$$;
