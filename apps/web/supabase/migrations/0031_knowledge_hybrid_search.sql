-- Open-webui parity: hybrid knowledge retrieval.
-- Adds BM25 (tsvector full-text) alongside the existing pgvector cosine path,
-- fuses them via weighted Reciprocal Rank Fusion. RRF avoids score-normalization
-- fragility; p_bm25_weight tunes the lexical/semantic mix (0 = vector-only,
-- 1 = lexical-only, 0.5 = balanced). Tenant-scoped, no cross-user leakage.
--
-- Backward compatible: the existing match_knowledge_chunks(p_user_id, ...) is
-- untouched; callers opt into hybrid by name. Push to remote Supabase is owner-gated.
--
-- ponytail: param stays p_customer_id to match the runtime call in
-- retrieve-context.ts (which passes userId into it); it holds a user_id and is
-- compared against aio_knowledge_chunks.user_id.

-- Expression GIN index so the lexical branch can use the index for @@ matches.
CREATE INDEX IF NOT EXISTS aio_knowledge_chunks_content_tsv_idx
  ON aio_knowledge_chunks USING gin (to_tsvector('english', content));

CREATE OR REPLACE FUNCTION match_knowledge_chunks_hybrid(
  p_customer_id     uuid,
  p_query_text      text,
  p_query_embedding vector(1536),
  p_match_count     int   DEFAULT 5,
  p_candidate_k     int   DEFAULT 20,
  p_bm25_weight     float DEFAULT 0.5
) RETURNS TABLE (
  id          uuid,
  doc_id      uuid,
  content     text,
  similarity  float   -- fused RRF score (not cosine); higher = better
) AS $$
  WITH vec AS (
    SELECT c.id, row_number() OVER (ORDER BY c.embedding <=> p_query_embedding) AS r
    FROM aio_knowledge_chunks c
    WHERE c.user_id = p_customer_id
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_candidate_k
  ),
  lex AS (
    SELECT c.id, row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('english', c.content), plainto_tsquery('english', p_query_text)) DESC) AS r
    FROM aio_knowledge_chunks c
    WHERE c.user_id = p_customer_id
      AND to_tsvector('english', c.content) @@ plainto_tsquery('english', p_query_text)
    ORDER BY ts_rank_cd(to_tsvector('english', c.content), plainto_tsquery('english', p_query_text)) DESC
    LIMIT p_candidate_k
  )
  SELECT
    c.id,
    c.doc_id,
    c.content,
    (COALESCE((1.0 - p_bm25_weight) / (60 + vec.r), 0)
     + COALESCE(p_bm25_weight / (60 + lex.r), 0))::float AS similarity
  FROM aio_knowledge_chunks c
  LEFT JOIN vec ON vec.id = c.id
  LEFT JOIN lex ON lex.id = c.id
  WHERE vec.id IS NOT NULL OR lex.id IS NOT NULL
  ORDER BY similarity DESC
  LIMIT p_match_count;
$$ LANGUAGE sql STABLE;
