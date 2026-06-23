import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { resolveHermesRequestContext, THREAD_COOKIE } from "@/lib/hermes/request-context";
import { createServiceClient } from "@/lib/supabase/service";

interface ConversationRow {
  id: string;
  title: string;
  updated_at: string;
}

// GET /api/conversations — sidebar "Recent" list, newest first.
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId } = ctxResult.ctx;

  const db = createServiceClient();
  const { data, error } = await db
    .from("hermes_conversations")
    .select("id, title, updated_at")
    .eq("customer_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: `Failed to list conversations: ${error.message}` }, { status: 500 });
  }

  const conversations = ((data ?? []) as ConversationRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at,
  }));

  return Response.json({ conversations });
}

// POST /api/conversations — "New Chat": creates a fresh thread, switches the
// active hermes_thread_id cookie to it. The row itself is created lazily by
// chat/route.ts on the first message (keeps empty threads out of the list).
export async function POST() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;

  const newThreadId = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(THREAD_COOKIE, newThreadId, { httpOnly: true, sameSite: "lax" });

  return Response.json({ id: newThreadId });
}
