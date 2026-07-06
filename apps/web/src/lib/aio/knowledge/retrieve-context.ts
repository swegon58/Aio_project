import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmbeddingProvider } from "./embeddings";
import { getToolValves } from "./valves";

export async function buildKnowledgeContext(
  db: SupabaseClient,
  userId: string,
  embeddingProvider: EmbeddingProvider,
  lastMessage: { role: string; content: unknown } | undefined,
): Promise<string | null> {
  const queryText = typeof lastMessage?.content === "string" ? lastMessage.content : "";
  if (!queryText.trim()) return null;

  try {
    const queryEmbedding = await embeddingProvider.embedOne(queryText);
    // Per-customer valves for knowledge_retrieval (migration 0032). Defaults
    // mirror the RPC's own defaults so a missing row changes nothing.
    const valves = await getToolValves(db, userId, "knowledge_retrieval");
    const bm25Weight =
      typeof valves.bm25_weight === "number" ? valves.bm25_weight : 0.5;
    const matchCount =
      typeof valves.match_count === "number" ? valves.match_count : 5;
    const { data, error } = await db.rpc("match_knowledge_chunks_hybrid", {
      p_customer_id: userId,
      p_query_text: queryText,
      p_query_embedding: queryEmbedding,
      p_match_count: matchCount,
      p_bm25_weight: bm25Weight,
    });
    if (error || !data || data.length === 0) return null;

    const snippets = (data as { content: string }[]).map((row, i) => `[${i + 1}] ${row.content}`).join("\n\n");
    return `The user has uploaded documents to their knowledge base. The following excerpts may be relevant to their current message. Use them if helpful, and ignore them if not relevant. Do not mention "knowledge base", "documents", or these excerpts explicitly unless the user asks where the information came from.\n\n${snippets}`;
  } catch {
    return null;
  }
}
