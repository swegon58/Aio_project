import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "aio-images";
const SIGNED_URL_TTL_S = 60 * 60; // 1h — long enough for a gallery page view.

interface GalleryImageRow {
  id: string;
  customer_id: string;
  session_id: string | null;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

// GET /api/gallery — list the signed-in customer's persisted gallery images,
// newest first, with short-lived signed URLs for the private `aio-images`
// bucket (Storage objects are never public — see Batch D constraints).
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const db = createServiceClient();

  const { data, error } = await db
    .from("hermes_gallery_images")
    .select("id, customer_id, session_id, storage_path, caption, created_at")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: `Failed to list gallery: ${error.message}` }, { status: 500 });
  }

  const rows = (data ?? []) as GalleryImageRow[];
  const paths = rows.map((r) => r.storage_path);

  let signedUrlByPath = new Map<string, string | null>();
  if (paths.length > 0) {
    const { data: signed, error: signError } = await db.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_S);
    if (signError) {
      return Response.json({ error: `Failed to sign URLs: ${signError.message}` }, { status: 500 });
    }
    signedUrlByPath = new Map(
      (signed ?? []).map((s) => [s.path ?? "", s.signedUrl]),
    );
  }

  const images = rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    caption: r.caption,
    createdAt: r.created_at,
    url: signedUrlByPath.get(r.storage_path) ?? null,
  }));

  return Response.json({ images });
}

// POST /api/gallery — upload an image to the private `aio-images` bucket
// (pre-existing, public: false) and persist its metadata. Body: multipart
// form-data with a `file` field and an optional `caption` field.
//
// Fallback design note: hermes-agent's /v1/runs SSE stream (see
// src/app/api/chat/route.ts) has no image-generation event today —
// tool.started/tool.completed only carry `tool`/`preview`/`duration`/`error`,
// no artifact payload. There is nothing to hook persistence onto mid-stream.
// This route is therefore the only path into the gallery: an explicit
// "save to gallery" action (e.g. attaching/uploading an image from the chat
// UI), not an automatic capture of agent-generated images.
export async function POST(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId, hermesSessionId } = ctxResult.ctx;

  const form = await req.formData();
  const file = form.get("file");
  const caption = form.get("caption");

  if (!(file instanceof File)) {
    return Response.json({ error: "missing_file", message: "file is required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "invalid_type", message: "file must be an image" }, { status: 400 });
  }

  const db = createServiceClient();

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return Response.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await db
    .from("hermes_gallery_images")
    .insert({
      customer_id: userId,
      session_id: hermesSessionId.startsWith("dev-session-") ? null : hermesSessionId,
      storage_path: storagePath,
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : null,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    // Roll back the orphaned Storage object so failures don't leak storage.
    await db.storage.from(BUCKET).remove([storagePath]);
    return Response.json({ error: `Failed to save metadata: ${insertError.message}` }, { status: 500 });
  }

  const { data: signed } = await db.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_S);

  return Response.json({
    id: inserted.id,
    createdAt: inserted.created_at,
    url: signed?.signedUrl ?? null,
  });
}

// DELETE /api/gallery?id=<uuid> — remove an image (Storage object + row).
export async function DELETE(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "missing_id", message: "id query param is required" }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: row, error: fetchError } = await db
    .from("hermes_gallery_images")
    .select("storage_path")
    .eq("id", id)
    .eq("customer_id", userId)
    .single();

  if (fetchError || !row) {
    return Response.json({ error: "not_found", message: "Image not found" }, { status: 404 });
  }

  await db.storage.from(BUCKET).remove([row.storage_path]);

  const { error: deleteError } = await db
    .from("hermes_gallery_images")
    .delete()
    .eq("id", id)
    .eq("customer_id", userId);

  if (deleteError) {
    return Response.json({ error: `Failed to delete: ${deleteError.message}` }, { status: 500 });
  }

  return Response.json({ ok: true });
}
