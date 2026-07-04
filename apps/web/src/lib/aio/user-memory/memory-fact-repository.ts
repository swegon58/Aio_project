import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_MEMORY_FACT_LABEL = 80;
export const MAX_MEMORY_FACT_VALUE = 500;

export type MemoryFact = {
  id: string;
  label: string;
  value: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

interface MemoryFactRow {
  id: string;
  customer_id: string;
  label: string;
  value: string;
  source: string;
  created_at: string;
  updated_at: string;
}

function fromRow(row: MemoryFactRow): MemoryFact {
  return {
    id: row.id,
    label: row.label,
    value: row.value,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateLabel(label: string): void {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required.");
  if (trimmed.length > MAX_MEMORY_FACT_LABEL) {
    throw new Error(`Label must be ${MAX_MEMORY_FACT_LABEL} characters or fewer.`);
  }
}

function validateValue(value: string): void {
  if (value.length > MAX_MEMORY_FACT_VALUE) {
    throw new Error(`Value must be ${MAX_MEMORY_FACT_VALUE} characters or fewer.`);
  }
}

export async function listFacts(
  db: SupabaseClient,
  customerId: string,
): Promise<MemoryFact[]> {
  const { data, error } = await db
    .from("aio_user_memory_facts")
    .select("id, customer_id, label, value, source, created_at, updated_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as MemoryFactRow[]).map(fromRow);
}

export async function createFact(
  db: SupabaseClient,
  customerId: string,
  input: { label: string; value: string },
): Promise<MemoryFact> {
  validateLabel(input.label);
  validateValue(input.value);

  const { data, error } = await db
    .from("aio_user_memory_facts")
    .insert({
      customer_id: customerId,
      label: input.label.trim(),
      value: input.value,
      source: "manual",
    })
    .select("id, customer_id, label, value, source, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Insert failed.");
  return fromRow(data as MemoryFactRow);
}

export async function updateFact(
  db: SupabaseClient,
  customerId: string,
  id: string,
  patch: { label?: string; value?: string },
): Promise<MemoryFact> {
  if (patch.label !== undefined) validateLabel(patch.label);
  if (patch.value !== undefined) validateValue(patch.value);

  const updateData: Record<string, string> = {};
  if (patch.label !== undefined) updateData.label = patch.label.trim();
  if (patch.value !== undefined) updateData.value = patch.value;

  const { data, error } = await db
    .from("aio_user_memory_facts")
    .update(updateData)
    .eq("customer_id", customerId)
    .eq("id", id)
    .select("id, customer_id, label, value, source, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Memory fact not found.");
  return fromRow(data as MemoryFactRow);
}

export async function deleteFact(
  db: SupabaseClient,
  customerId: string,
  id: string,
): Promise<void> {
  const { error, count } = await db
    .from("aio_user_memory_facts")
    .delete({ count: "exact" })
    .eq("customer_id", customerId)
    .eq("id", id);

  if (error) throw new Error(error.message);
  if (!count) throw new Error("Memory fact not found.");
}