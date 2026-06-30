// R6.8 beta gate: invite-only cohort check. Off by default (current
// open-signup behavior) — only enforced when AIO_BETA_INVITE_ONLY=true,
// which the owner sets once the `aio_beta_invites` table is populated.
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail } from "@/lib/hermes/registry";

const OWNER_EMAIL = process.env.AIO_OWNER_EMAIL ?? "";

export function isBetaInviteOnlyEnabled(): boolean {
  return process.env.AIO_BETA_INVITE_ONLY === "true";
}

// `aio_beta_invites.email` rows must be pre-normalized (lowercase, no
// "+tag", no dots in the local part) — same convention as
// hermes_registry.normalized_email — since this does an exact-match lookup.
export async function isEmailInvited(db: SupabaseClient, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (OWNER_EMAIL && normalizeEmail(OWNER_EMAIL) === normalized) return true;

  const { data, error } = await db
    .from("aio_beta_invites")
    .select("email, revoked_at")
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw new Error(`Invite lookup failed: ${error.message}`);
  return data !== null && data.revoked_at === null;
}
