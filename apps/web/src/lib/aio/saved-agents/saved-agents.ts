// R7 Saved Agents — user-owned, additive instruction bundles. See
// docs/roadmap/R7_SAVED_AGENTS_ONEPAGER.md for scope and the deliberate
// omission of tool/model overrides.
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_NAME_LENGTH = 80;
const MAX_INSTRUCTIONS_LENGTH = 4000;

export interface SavedAgent {
  id: string;
  customerId: string;
  name: string;
  instructionsAddition: string;
  useKnowledge: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SavedAgentRow {
  id: string;
  customer_id: string;
  name: string;
  instructions_addition: string;
  use_knowledge: boolean;
  created_at: string;
  updated_at: string;
}

function fromRow(row: SavedAgentRow): SavedAgent {
  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    instructionsAddition: row.instructions_addition,
    useKnowledge: row.use_knowledge,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SavedAgentResult<T> = { ok: true; data: T } | { ok: false; message: string };

export function validateSavedAgentInput(input: {
  name: string;
  instructionsAddition: string;
}): string | null {
  const name = input.name.trim();
  if (!name) return "Name is required.";
  if (name.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  if (input.instructionsAddition.length > MAX_INSTRUCTIONS_LENGTH) {
    return `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or fewer.`;
  }
  return null;
}

export async function listSavedAgents(
  db: SupabaseClient,
  customerId: string,
): Promise<SavedAgentResult<SavedAgent[]>> {
  const { data, error } = await db
    .from("aio_saved_agents")
    .select("id, customer_id, name, instructions_addition, use_knowledge, created_at, updated_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as SavedAgentRow[]).map(fromRow) };
}

export async function getSavedAgent(
  db: SupabaseClient,
  customerId: string,
  id: string,
): Promise<SavedAgentResult<SavedAgent>> {
  const { data, error } = await db
    .from("aio_saved_agents")
    .select("id, customer_id, name, instructions_addition, use_knowledge, created_at, updated_at")
    .eq("customer_id", customerId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Saved agent not found." };
  return { ok: true, data: fromRow(data as SavedAgentRow) };
}

export async function createSavedAgent(
  db: SupabaseClient,
  customerId: string,
  input: { name: string; instructionsAddition: string; useKnowledge: boolean },
): Promise<SavedAgentResult<SavedAgent>> {
  const invalid = validateSavedAgentInput(input);
  if (invalid) return { ok: false, message: invalid };

  const { data, error } = await db
    .from("aio_saved_agents")
    .insert({
      customer_id: customerId,
      name: input.name.trim(),
      instructions_addition: input.instructionsAddition,
      use_knowledge: input.useKnowledge,
    })
    .select("id, customer_id, name, instructions_addition, use_knowledge, created_at, updated_at")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Insert failed." };
  return { ok: true, data: fromRow(data as SavedAgentRow) };
}

export async function updateSavedAgent(
  db: SupabaseClient,
  customerId: string,
  id: string,
  input: { name: string; instructionsAddition: string; useKnowledge: boolean },
): Promise<SavedAgentResult<SavedAgent>> {
  const invalid = validateSavedAgentInput(input);
  if (invalid) return { ok: false, message: invalid };

  const { data, error } = await db
    .from("aio_saved_agents")
    .update({
      name: input.name.trim(),
      instructions_addition: input.instructionsAddition,
      use_knowledge: input.useKnowledge,
      updated_at: new Date().toISOString(),
    })
    .eq("customer_id", customerId)
    .eq("id", id)
    .select("id, customer_id, name, instructions_addition, use_knowledge, created_at, updated_at")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Saved agent not found." };
  return { ok: true, data: fromRow(data as SavedAgentRow) };
}

export async function deleteSavedAgent(
  db: SupabaseClient,
  customerId: string,
  id: string,
): Promise<SavedAgentResult<true>> {
  const { error, count } = await db
    .from("aio_saved_agents")
    .delete({ count: "exact" })
    .eq("customer_id", customerId)
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  if (!count) return { ok: false, message: "Saved agent not found." };
  return { ok: true, data: true };
}
