import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

export type HermesRegistryStatus =
  | "provisioned"
  | "running"
  | "idle"
  | "stopped"
  | "failed";

export interface HermesRegistryRow {
  customer_id: string;
  profile_name: string | null;
  port: number | null;
  endpoint: string | null;
  status: HermesRegistryStatus;
  api_server_key_ref: string | null;
  openrouter_key_ref: string | null;
  openrouter_key_hash: string | null;
  commit_pin: string | null;
  pid: number | null;
  last_active_at: string;
  normalized_email: string;
  credit_balance: number;
  plan_tier: string;
  free_grant_used: boolean;
  onboarded_at: string | null;
  activated_at: string | null;
}

export interface HermesThreadRow {
  session_id: string;
  customer_id: string;
  thread_id: string;
  title: string | null;
  created_at: string;
}

// Q30 Sybil mitigation: strip "+tag" and dots from the local part (Gmail-style).
export function normalizeEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  const stripped = local.split("+")[0].replace(/\./g, "");
  return `${stripped}@${domain}`;
}

export async function getRegistryRow(
  db: SupabaseClient,
  customerId: string,
): Promise<HermesRegistryRow | null> {
  const { data, error } = await db
    .from("hermes_registry")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(`Registry lookup failed: ${error.message}`);
  return data as HermesRegistryRow | null;
}

// Ensures a registry row exists for the customer (status='provisioned', no
// profile/port assigned yet — BUILD_SPEC §4 step 6 happens incrementally as
// the provisioning flow progresses). Idempotent.
export async function ensureRegistryRow(
  db: SupabaseClient,
  customerId: string,
  email: string,
): Promise<HermesRegistryRow> {
  const existing = await getRegistryRow(db, customerId);
  if (existing) return existing;

  const { data, error } = await db
    .from("hermes_registry")
    .insert({
      customer_id: customerId,
      normalized_email: normalizeEmail(email),
      status: "provisioned",
    })
    .select("*")
    .single();
  if (error) throw new Error(`Registry insert failed: ${error.message}`);

  // Q22 free trial: grant on first-ever row only (free_grant_used flag,
  // tied to the normalized_email Sybil dedup above — a second signup with
  // a "+tag" variant of the same Gmail address collides on
  // normalized_email and never reaches this insert).
  const { grantFreeTrialIfNeeded } = await import("./billing");
  return grantFreeTrialIfNeeded(db, data as HermesRegistryRow);
}

export async function updateRegistryRow(
  db: SupabaseClient,
  customerId: string,
  patch: Partial<
    Pick<
      HermesRegistryRow,
      | "profile_name"
      | "port"
      | "endpoint"
      | "status"
      | "api_server_key_ref"
      | "openrouter_key_ref"
      | "openrouter_key_hash"
      | "commit_pin"
      | "pid"
      | "last_active_at"
      | "onboarded_at"
      | "activated_at"
    >
  >,
): Promise<HermesRegistryRow> {
  const { data, error } = await db
    .from("hermes_registry")
    .update(patch)
    .eq("customer_id", customerId)
    .select("*")
    .single();
  if (error) throw new Error(`Registry update failed: ${error.message}`);
  return data as HermesRegistryRow;
}

// R6.1 activation: flips activated_at on first successful run only. The
// `is null` guard makes this idempotent — later successful runs are no-ops
// and return false so callers don't re-fire the activation event.
export async function markActivatedIfNeeded(
  db: SupabaseClient,
  customerId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("hermes_registry")
    .update({ activated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .is("activated_at", null)
    .select("customer_id");
  if (error) throw new Error(`Activation update failed: ${error.message}`);
  return (data ?? []).length > 0;
}

export async function getAllPorts(db: SupabaseClient): Promise<number[]> {
  const { data, error } = await db
    .from("hermes_registry")
    .select("port")
    .not("port", "is", null);
  if (error) throw new Error(`Port list failed: ${error.message}`);
  return (data ?? []).map((row) => row.port as number);
}

export async function getRunningRows(
  db: SupabaseClient,
): Promise<HermesRegistryRow[]> {
  const { data, error } = await db
    .from("hermes_registry")
    .select("*")
    .in("status", ["running", "idle"]);
  if (error) throw new Error(`Running-rows lookup failed: ${error.message}`);
  return (data ?? []) as HermesRegistryRow[];
}

// hermes_threads: per-(customer, thread) -> Hermes Session-Id (BUILD_SPEC §6/§12).
export async function getOrCreateThreadSession(
  db: SupabaseClient,
  customerId: string,
  threadId: string,
): Promise<HermesThreadRow> {
  const { data: existing, error: selectError } = await db
    .from("hermes_threads")
    .select("*")
    .eq("customer_id", customerId)
    .eq("thread_id", threadId)
    .maybeSingle();
  if (selectError) throw new Error(`Thread lookup failed: ${selectError.message}`);
  if (existing) return existing as HermesThreadRow;

  const { data: created, error: insertError } = await db
    .from("hermes_threads")
    .insert({ customer_id: customerId, thread_id: threadId })
    .select("*")
    .single();
  if (insertError) throw new Error(`Thread insert failed: ${insertError.message}`);
  return created as HermesThreadRow;
}

export function serviceDb(): SupabaseClient {
  return createServiceClient();
}

// Q41 Vault wiring: store/update a customer's per-customer OpenRouter API
// key in Supabase Vault (migration 0004), returns the Vault secret UUID to
// persist in hermes_registry.openrouter_key_ref. `existingRef` rotates the
// existing secret in place (respawn case) instead of creating a new one.
export async function storeOpenRouterKeyInVault(
  db: SupabaseClient,
  customerId: string,
  rawKey: string,
  existingRef: string | null,
): Promise<string> {
  const { data, error } = await db.rpc("vault_store_openrouter_key", {
    p_customer_id: customerId,
    p_secret: rawKey,
    p_existing_ref: existingRef,
  });
  if (error) throw new Error(`Vault store (OpenRouter key) failed: ${error.message}`);
  return data as string;
}

// Reads a customer's per-customer OpenRouter API key out of Supabase Vault
// by secret UUID — orchestrator-only, called at profile spawn to write
// the ephemeral profile `.env` (Q41).
export async function readOpenRouterKeyFromVault(
  db: SupabaseClient,
  secretRef: string,
): Promise<string | null> {
  const { data, error } = await db.rpc("vault_read_openrouter_key", {
    p_secret_ref: secretRef,
  });
  if (error) throw new Error(`Vault read (OpenRouter key) failed: ${error.message}`);
  return (data as string | null) ?? null;
}

// Batch E — generic per-customer credential vault (migration 0006), for
// secrets outside the dedicated openrouter_key_ref column and outside the
// Connections-tab platform tokens (those live in the profile .env, see
// platforms.ts). One Vault secret per (customer_id, key_name) pair, tracked
// in hermes_credential_refs.
export async function storeCredentialInVault(
  db: SupabaseClient,
  customerId: string,
  keyName: string,
  rawValue: string,
): Promise<string> {
  const { data, error } = await db.rpc("vault_store_credential", {
    p_customer_id: customerId,
    p_key_name: keyName,
    p_secret: rawValue,
  });
  if (error) throw new Error(`Vault store (${keyName}) failed: ${error.message}`);
  return data as string;
}

export async function readCredentialFromVault(
  db: SupabaseClient,
  customerId: string,
  keyName: string,
): Promise<string | null> {
  const { data, error } = await db.rpc("vault_read_credential", {
    p_customer_id: customerId,
    p_key_name: keyName,
  });
  if (error) throw new Error(`Vault read (${keyName}) failed: ${error.message}`);
  return (data as string | null) ?? null;
}
