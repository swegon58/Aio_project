import type { SupabaseClient } from "@supabase/supabase-js";

// Generic per-customer tool-valve reader. Returns {} when no row exists or the
// read fails — callers layer their own defaults on top, so a missing knob must
// never throw. Backed by the aio_tool_valves table (migration 0032).
export async function getToolValves(
  db: SupabaseClient,
  userId: string,
  toolId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await db
    .from("aio_tool_valves")
    .select("valves")
    .eq("customer_id", userId)
    .eq("tool_id", toolId)
    .single();

  if (error || !data) return {};
  return (data.valves as Record<string, unknown> | null) ?? {};
}
