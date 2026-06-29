// R4.5 — Knowledge Center ingestion pipeline.
//
// Stages: upload → validate → store → parse → chunk → embed → index
//
// Callers:
//   POST /api/knowledge/upload  — kicks off the pipeline for one file
//   The pipeline is intentionally synchronous-but-async: each stage awaits the
//   previous one and updates the doc status row so the UI can show progress.
//
// No raw document content is stored in Postgres — only chunks and embeddings.
// The original file is stored in Supabase Storage (user-scoped, not shared).

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts, EMBEDDING_DIMENSIONS } from "@/lib/aio/knowledge/embeddings";
export {
  validateKnowledgeFile,
  chunkText,
  extractTextFromBuffer,
  type ValidationResult,
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_CHARS,
} from "./ingest-utils";

// ---------------------------------------------------------------------------
// Indexing (write chunks + embeddings to Postgres)
// ---------------------------------------------------------------------------

export interface IndexResult {
  chunkCount: number;
  error?: string;
}

export async function indexKnowledgeChunks(
  db: SupabaseClient,
  userId: string,
  docId: string,
  chunks: string[],
  openrouterApiKey: string,
): Promise<IndexResult> {
  if (!chunks.length) return { chunkCount: 0 };

  // Embed all chunks in one batch call.
  let embeddings: number[][] = [];
  try {
    embeddings = await embedTexts(openrouterApiKey, chunks);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { chunkCount: 0, error: `embedding failed: ${msg}` };
  }

  if (embeddings.length !== chunks.length) {
    return { chunkCount: 0, error: `embedding count mismatch: ${embeddings.length} vs ${chunks.length}` };
  }

  // Validate embedding dimensions.
  const badDim = embeddings.find((e) => e.length !== EMBEDDING_DIMENSIONS);
  if (badDim) {
    return { chunkCount: 0, error: `unexpected embedding dimension: ${badDim.length} (expected ${EMBEDDING_DIMENSIONS})` };
  }

  // Batch insert — Supabase limits upserts to 1000 rows; chunk if needed.
  const rows = chunks.map((content, i) => ({
    user_id: userId,
    doc_id: docId,
    chunk_index: i,
    content,
    token_count: Math.ceil(content.length / 4),
    embedding: JSON.stringify(embeddings[i]),
  }));

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await db.from("aio_knowledge_chunks").insert(batch);
    if (error) return { chunkCount: i, error: error.message };
  }

  return { chunkCount: chunks.length };
}

// ---------------------------------------------------------------------------
// Status transitions (doc status machine)
// ---------------------------------------------------------------------------

export type KnowledgeDocStatus =
  | "uploaded" | "parsing" | "chunking" | "embedding" | "ready" | "error";

export async function setDocStatus(
  db: SupabaseClient,
  docId: string,
  userId: string,
  status: KnowledgeDocStatus,
  opts: { chunkCount?: number; errorMessage?: string } = {},
): Promise<void> {
  const { error } = await db
    .from("aio_knowledge_docs")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(opts.chunkCount !== undefined && { chunk_count: opts.chunkCount }),
      ...(opts.errorMessage !== undefined && { error_message: opts.errorMessage }),
    })
    .eq("id", docId)
    .eq("user_id", userId);
  if (error) console.error(`setDocStatus(${docId}, ${status}):`, error.message);
}
