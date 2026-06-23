import { cookies } from "next/headers";
import { resolveHermesRequestContext, THREAD_COOKIE } from "@/lib/hermes/request-context";
import { createServiceClient } from "@/lib/supabase/service";

// GET /api/conversations/[id] — load a past thread's messages and switch the
// active hermes_thread_id cookie to it, so the next /api/chat call continues
// this conversation instead of starting a new one.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;
  const { id } = await params;

  const db = createServiceClient();
  const { data, error } = await db
    .from("hermes_conversations")
    .select("id, title, messages")
    .eq("id", id)
    .eq("customer_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: `Failed to load conversation: ${error.message}` }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set(THREAD_COOKIE, id, { httpOnly: true, sameSite: "lax" });

  return Response.json({ id: data.id, title: data.title, messages: data.messages });
}

// PATCH /api/conversations/[id] — rename a chat.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { title?: string } | null;
  const title = body?.title?.trim();
  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from("hermes_conversations")
    .update({ title })
    .eq("id", id)
    .eq("customer_id", userId);

  if (error) {
    return Response.json({ error: `Failed to rename conversation: ${error.message}` }, { status: 500 });
  }

  return Response.json({ ok: true, title });
}

// DELETE /api/conversations/[id] — remove a chat from history.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;
  const { id } = await params;

  const db = createServiceClient();
  const { error } = await db
    .from("hermes_conversations")
    .delete()
    .eq("id", id)
    .eq("customer_id", userId);

  if (error) {
    return Response.json({ error: `Failed to delete conversation: ${error.message}` }, { status: 500 });
  }

  return Response.json({ ok: true });
}
