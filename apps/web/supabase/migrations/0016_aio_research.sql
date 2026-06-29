-- R4.2b: Deep Research — sources and claims tables.
-- Research metadata is stored in aio_runs.metadata (jsonb), not a separate table,
-- to avoid an extra join on the hot path. Only claim and source rows are separate.

-- Research sources (one per URL/doc fetched during a research run)
CREATE TABLE IF NOT EXISTS aio_research_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES aio_runs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  title           TEXT,
  content_hash    TEXT,           -- SHA-256 of fetched content (no raw content stored)
  source_type     TEXT NOT NULL DEFAULT 'web'
                  CHECK (source_type IN ('web', 'knowledge_doc', 'provided')),
  relevance_score FLOAT,
  fetched_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE aio_research_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own sources"
  ON aio_research_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_research_sources_run ON aio_research_sources(run_id);
CREATE INDEX idx_research_sources_user ON aio_research_sources(user_id, created_at DESC);

-- Research claims (one per factual claim found during synthesis)
-- claim_text itself is NOT stored — only a hash (PII/content boundary).
CREATE TABLE IF NOT EXISTS aio_research_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES aio_runs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id       UUID REFERENCES aio_research_sources(id) ON DELETE SET NULL,
  claim_hash      TEXT NOT NULL,   -- SHA-256 of normalized claim text
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  conflict        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE aio_research_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own claims"
  ON aio_research_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_research_claims_run ON aio_research_claims(run_id);
CREATE INDEX idx_research_claims_user ON aio_research_claims(user_id);

-- Add research-specific columns to aio_runs.metadata (no ALTER needed — it's jsonb).
-- The orchestrator writes:
--   metadata.research_plan   (text — the emitted plan, written at stage 2)
--   metadata.stage_completed (int 0-7)
--   metadata.search_count    (int)
--   metadata.claim_count     (int)
--   metadata.verified_count  (int)
-- No migration needed for jsonb columns; this comment documents the contract.

COMMENT ON TABLE aio_research_sources IS 'R4: one row per source URL or knowledge doc fetched during a research run.';
COMMENT ON TABLE aio_research_claims IS 'R4: one row per factual claim hash (no raw text) identified during synthesis.';
