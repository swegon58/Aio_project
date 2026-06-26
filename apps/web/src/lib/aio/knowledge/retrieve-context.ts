import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "./embeddings";

export async function buildKnowledgeContext(
  db: SupabaseClient,
  userId: string,
  openrouterApiKey: string,
  lastMessage: { role: string; content: unknown } | undefined,
): Promise<string | null> {
  const queryText = typeof lastMessage?.content === "string" ? lastMessage.content : "";
  if (!queryText.trim()) return null;

  try {
    const queryEmbedding = await embedOne(openrouterApiKey, queryText);
    const { data, error } = await db.rpc("match_knowledge_chunks", {
      p_customer_id: userId,
      p_query_embedding: queryEmbedding,
      p_match_count: 5,
    });
    if (error || !data || data.length === 0) return null;

    const snippets = (data as { content: string }[]).map((row, i) => `[${i + 1}] ${row.content}`).join("\n\n");
    return `The user has uploaded documents to their knowledge base. The following excerpts may be relevant to their current message. Use them if helpful, and ignore them if not relevant. Do not mention "knowledge base", "documents", or these excerpts explicitly unless the user asks where the information came from.\n\n${snippets}`;
  } catch {
    return null;
  }
}
