// R4.5 — Knowledge Center API: list + upload documents.
//
// Uses aio_knowledge_docs + aio_knowledge_chunks (migration 0015).
// Upload: validate → store in Supabase Storage → insert doc row → chunk + embed
// (text/plain & .md only for now; PDF/DOCX deferred to post-MVP extraction).
// GET:    list the caller's docs with status and chunk count.

import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveOpenRouterKeyForProfile } from "@/lib/hermes/knowledge";
import {
  validateKnowledgeFile,
  chunkText,
  indexKnowledgeChunks,
  setDocStatus,
} from "@/lib/aio/knowledge/ingest-pipeline";

const BUCKET = "aio-knowledge";

// GET /api/knowledge/docs — list the caller's uploaded documents.
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const db = createServiceClient();
  const { data, error } = await db
    .from("aio_knowledge_docs")
    .select("id, file_name, file_size, mime_type, status, chunk_count, error_message, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ docs: data ?? [] });
}

// POST /api/knowledge/docs — upload a document into the Knowledge Center.
// Multipart form-data: `file` field required.
export async function POST(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId, row } = ctxResult.ctx;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing_file", message: "file field is required" }, { status: 400 });
  }

  const validation = validateKnowledgeFile(file.name, file.type, file.size);
  if (!validation.ok) {
    return Response.json({ error: "validation_failed", message: validation.error }, { status: 400 });
  }

  const apiKey = await resolveOpenRouterKeyForProfile(row.profile_name);
  if (!apiKey) {
    return Response.json(
      { error: "no_api_key", message: "No OpenRouter API key configured for embedding." },
      { status: 500 },
    );
  }

  const db = createServiceClient();
  const storagePath = `${userId}/${crypto.randomUUID()}-${file.name}`;

  // Store raw file in Supabase Storage.
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    return Response.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Insert the doc row (status: uploaded).
  const { data: docRow, error: insertError } = await db
    .from("aio_knowledge_docs")
    .insert({
      user_id: userId,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      storage_path: storagePath,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (insertError || !docRow) {
    await db.storage.from(BUCKET).remove([storagePath]);
    return Response.json({ error: `Failed to create doc row: ${insertError?.message}` }, { status: 500 });
  }

  const docId = docRow.id as string;

  // Pipeline: parse → chunk → embed → index.
  // For text/* files we process inline; other types are left in 'parsing' status
  // for an async Hermes-extraction job (R4 post-MVP).
  const isTextFile = file.type.startsWith("text/") ||
    file.name.endsWith(".md") || file.name.endsWith(".txt");

  if (!isTextFile) {
    await setDocStatus(db, docId, userId, "parsing");
    return Response.json({
      id: docId,
      fileName: file.name,
      status: "parsing",
      message: "Document queued for extraction. Check status at GET /api/knowledge/docs.",
    }, { status: 202 });
  }

  try {
    await setDocStatus(db, docId, userId, "chunking");
    const text = await file.text();
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("Document contained no extractable text.");

    await setDocStatus(db, docId, userId, "embedding");
    const result = await indexKnowledgeChunks(db, userId, docId, chunks, apiKey);
    if (result.error) throw new Error(result.error);

    await setDocStatus(db, docId, userId, "ready", { chunkCount: result.chunkCount });
    return Response.json({ id: docId, fileName: file.name, status: "ready", chunkCount: result.chunkCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setDocStatus(db, docId, userId, "error", { errorMessage: msg });
    return Response.json({ id: docId, fileName: file.name, status: "error", error: msg }, { status: 500 });
  }
}
