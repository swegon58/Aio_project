# ADR-003: Deep Research and Knowledge Center

**Status:** Accepted  
**Date:** 2026-06-29  
**Deciders:** Product owner

---

## Context

Aio's next flagship workflow after durable foundations (R1–R3) is **Deep Research**:
a multi-stage agent loop that autonomously discovers, reads, synthesizes, and
verifies information from the web and the user's own knowledge base, then
produces a structured report with inline citations.

The user's Knowledge Center lets them upload documents (PDF, DOCX, text) that
become part of the agent's retrieval context alongside live web results.

---

## Decision

### Research Pipeline Stages

| Stage | Name | What happens |
|---|---|---|
| 1 | **Understand** | Parse the research question; extract sub-questions and scope |
| 2 | **Plan** | Emit a research plan (sub-topics, source types, depth target) |
| 3 | **Discover** | Web search + knowledge-base vector query for candidate sources |
| 4 | **Inspect** | Fetch and read candidate pages; score relevance and credibility |
| 5 | **Synthesize** | Merge findings into a structured draft with claim→source mapping |
| 6 | **Verify** | Re-check factual claims against sources; flag conflicts |
| 7 | **Report** | Produce the final Markdown report with citations |

The pipeline runs inside the existing Hermes run lifecycle (`aio_runs`). Each
stage emits a `research.stage` event (new event type) that the UI renders as a
progress frame inside the conversation.

### Research Data Model

- **`aio_research_sources`** — one row per URL/document ingested for a research run:
  `run_id, url, title, content_hash, relevance_score, fetched_at`.
- **`aio_research_claims`** — one row per factual claim in the synthesis:
  `run_id, claim_text_hash, source_id (FK aio_research_sources), verified, conflict`.
- **`aio_runs.metadata`** — extended with `research_plan`, `stage_completed`, `search_count`,
  `claim_count`, `verified_count`.

### Knowledge Center Pipeline

Upload → validate (size, MIME) → store (Supabase Storage) → parse (pdf-parse / mammoth) →
chunk (≤ 512 tokens, 50-token overlap) → embed (OpenAI text-embedding-ada-002 via OpenRouter) →
index (pgvector on `knowledge_chunks`).

Retrieval: cosine similarity top-k (k=8) filtered by `user_id`; merged with web results before
synthesis.

### UI

- **Research progress frame**: a collapsible card inside the conversation showing
  stage name, progress (N/7), source count, and ETA.
- **Knowledge Center**: accessible from the Settings panel / sidebar — shows
  uploaded documents, ingestion status, and lets users delete documents or search
  them.

### PII / Security

- Source URLs are stored (not PII by default) — user can delete any knowledge doc.
- Claim text is hashed before storage; only the hash and a `verified` flag are in
  the DB, not the raw claim.
- No user-uploaded content is shared across users (RLS enforced by `user_id`).

### Scope Boundary

- R4 ships the pipeline, DB schema, progress UI, and Knowledge Center.
- Citation rendering in the final report (inline footnotes) is in-scope.
- Scheduled / recurring research runs are out-of-scope for R4 (deferred to R5).

---

## Consequences

- pgvector must be enabled on the Supabase project (`CREATE EXTENSION vector`).
- Embedding costs are paid per chunk at upload time (one-off per document).
- Web fetch happens inside Hermes tool calls — already gated by approval policy.
- The research pipeline does not bypass the credit/billing system; each stage
  consumes credits proportionally.
