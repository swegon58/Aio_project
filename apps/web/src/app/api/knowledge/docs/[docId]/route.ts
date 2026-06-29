// R4.5 — DELETE /api/knowledge/docs/[docId]
// Removes doc from Storage, deletes the row (cascades to chunks via FK).

import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "aio-knowledge";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> },
) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;
  const { docId } = await params;

  const db = createServiceClient();

  const { data: doc, error: fetchErr } = await db
    .from("aio_knowledge_docs")
    .select("storage_path")
    .eq("id", docId)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !doc) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Remove storage object (best-effort — don't block if missing).
  await db.storage.from(BUCKET).remove([doc.storage_path]).catch(() => {});

  const { error: deleteErr } = await db
    .from("aio_knowledge_docs")
    .delete()
    .eq("id", docId)
    .eq("user_id", userId);

  if (deleteErr) {
    return Response.json({ error: deleteErr.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
