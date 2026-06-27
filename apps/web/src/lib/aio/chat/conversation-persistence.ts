import type { UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AioChatMode, AioResearchSummary } from "@/lib/aio/chat/chat-mode";
import type { HermesShowcaseData } from "@/lib/hermes/chat-types";

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
