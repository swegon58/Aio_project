import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { createServiceClient } from "@/lib/supabase/service";
import { chunkText, embedTexts, resolveOpenRouterKeyForProfile } from "@/lib/hermes/knowledge";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const BUCKET = "aio-knowledge";
// MVP: plain-text formats only. PDF/docx extraction needs a parser library
// not yet in the project — reject early with a clear message instead of
// silently embedding garbage bytes.
const ACCEPTED_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);
const ACCEPTED_EXT = new Set(["txt", "md", "markdown", "csv"]);

interface KnowledgeFileRow {
  id: string;
  filename: string;
  status: string;
  chunk_count: number;
  error: string | null;
  created_at: string;
}

function isMissingKnowledgeSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "PGRST205" || message.includes("hermes_knowledge_files");
}

// GET /api/knowledge — list the signed-in customer's uploaded documents.
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const db = createServiceClient();
  const { data, error } = await db
    .from("hermes_knowledge_files")
    .select("id, filename, status, chunk_count, error, created_at")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingKnowledgeSchemaError(error)) {
      return Response.json({
        files: [],
        setupRequired: true,
        message: "Knowledge storage is not set up yet. Apply the 0008_knowledge_files migration to enable uploads.",
      });
    }
    return Response.json({ error: `Failed to list files: ${error.message}` }, { status: 500 });
  }

  return Response.json({ files: (data ?? []) as KnowledgeFileRow[] });
}

// POST /api/knowledge — upload a document, chunk + embed it, store it for
// retrieval at chat time (see chat/route.ts's knowledge-context injection).
// Body: multipart form-data with a `file` field.
export async function POST(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId, row } = ctxResult.ctx;

  const knowledgeRateLimit = checkRateLimit(`knowledge:${userId}`, 10, 60_000);
  if (!knowledgeRateLimit.allowed) return rateLimitResponse(knowledgeRateLimit.retryAfterSeconds);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing_file", message: "file is required" }, { status: 400 });
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!ACCEPTED_TYPES.has(file.type) && !ACCEPTED_EXT.has(ext)) {
    return Response.json(
      { error: "unsupported_type", message: "Only .txt, .md, and .csv files are supported right now." },
      { status: 400 },
    );
  }

  const apiKey = await resolveOpenRouterKeyForProfile(row.profile_name);
  if (!apiKey) {
    return Response.json(
      { error: "no_api_key", message: "No OpenRouter key configured for this account yet." },
      { status: 500 },
    );
  }

  const db = createServiceClient();
  const storagePath = `${userId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type || "text/plain", upsert: false });
  if (uploadError) {
    return Response.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: fileRow, error: insertError } = await db
    .from("hermes_knowledge_files")
    .insert({ customer_id: userId, filename: file.name, storage_path: storagePath, status: "processing" })
    .select("id, created_at")
    .single();
  if (insertError || !fileRow) {
    await db.storage.from(BUCKET).remove([storagePath]);
    return Response.json({ error: `Failed to save metadata: ${insertError?.message}` }, { status: 500 });
  }

  try {
    const text = await file.text();
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("Document had no extractable text.");
    }

    const embeddings = await embedTexts(apiKey, chunks);
    const chunkRows = chunks.map((content, i) => ({
      file_id: fileRow.id,
      customer_id: userId,
      chunk_index: i,
      content,
      embedding: embeddings[i],
    }));

    const { error: chunksError } = await db.from("hermes_knowledge_chunks").insert(chunkRows);
    if (chunksError) throw new Error(chunksError.message);

    await db
      .from("hermes_knowledge_files")
      .update({ status: "ready", chunk_count: chunks.length })
      .eq("id", fileRow.id);

    return Response.json({ id: fileRow.id, filename: file.name, status: "ready", chunkCount: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("hermes_knowledge_files").update({ status: "failed", error: message }).eq("id", fileRow.id);
    return Response.json({ id: fileRow.id, filename: file.name, status: "failed", error: message }, { status: 500 });
  }
}

// DELETE /api/knowledge?id=<uuid> — remove a document (Storage object,
// row, and its chunks via FK cascade).
export async function DELETE(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "missing_id", message: "id query param is required" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: fileRow, error: fetchError } = await db
    .from("hermes_knowledge_files")
    .select("storage_path")
    .eq("id", id)
    .eq("customer_id", userId)
    .single();
  if (fetchError || !fileRow) {
    return Response.json({ error: "not_found", message: "File not found" }, { status: 404 });
  }

  await db.storage.from(BUCKET).remove([fileRow.storage_path]);

  const { error: deleteError } = await db
    .from("hermes_knowledge_files")
    .delete()
    .eq("id", id)
    .eq("customer_id", userId);
  if (deleteError) {
    return Response.json({ error: `Failed to delete: ${deleteError.message}` }, { status: 500 });
  }

  return Response.json({ ok: true });
}
