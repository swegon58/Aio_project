import type { UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AioChatMode, AioResearchSummary } from "@/lib/aio/chat/chat-mode";
import type { AioGeneratedImage, HermesShowcaseData } from "@/lib/hermes/chat-types";

// aio_runs.conversation_id references hermes_conversations(id), but that row
// is only populated by persistConversation() after the reply finishes. A
// brand-new thread's first run has no conversation row yet, so createRun's
// FK insert fails — seed a placeholder row up front so the FK is satisfied.
export async function ensureConversationRow(db: SupabaseClient, userId: string, threadId: string) {
  const { data: existing } = await db
    .from("hermes_conversations")
    .select("id")
    .eq("id", threadId)
    .maybeSingle();
  if (existing) return;

  const { error } = await db
    .from("hermes_conversations")
    .insert({ id: threadId, customer_id: userId, title: "New chat" });
  if (error) {
    console.error(`ensureConversationRow failed for thread ${threadId}:`, error.message);
  }
}

export async function persistConversation(
  db: SupabaseClient,
  userId: string,
  threadId: string,
  messages: UIMessage[],
  assistantText: string,
  mode: AioChatMode,
  artifacts: { filePath: string; fileName?: string }[],
  showcases: HermesShowcaseData[],
  research?: AioResearchSummary,
  images?: AioGeneratedImage[],
) {
  const assistantMessage: UIMessage | null = assistantText
    ? {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [{ type: "text", text: assistantText }],
        metadata: {
          planMode: mode === "plan",
          mode,
          ...(research ? { research } : {}),
          ...(artifacts.length > 0 ? { artifacts } : {}),
          ...(showcases.length > 0 ? { showcases } : {}),
          ...(images && images.length > 0 ? { images } : {}),
        },
      }
    : null;
  const fullMessages = assistantMessage ? [...messages, assistantMessage] : messages;

  const { data: existing } = await db
    .from("hermes_conversations")
    .select("title")
    .eq("id", threadId)
    .maybeSingle();

  const firstUserText = messages[0]?.parts?.find(
    (p): p is { type: "text"; text: string } => p.type === "text",
  )?.text;
  const title = existing?.title ?? (firstUserText ? firstUserText.slice(0, 60) : "New chat");

  const { error } = await db.from("hermes_conversations").upsert(
    {
      id: threadId,
      customer_id: userId,
      title,
      messages: fullMessages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error(`persistConversation failed for thread ${threadId}:`, error.message);
  }
}
