// R10.1: disconnects Google Calendar — revokes the grant on Google's side
// first (clearing our own records alone does not revoke it), then clears
// the vault ref, the profile token file, and marks the connection revoked.

import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { readCredentialFromVault } from "@/lib/hermes/registry";
import { deleteGoogleTokenFile, revokeGoogleToken } from "@/lib/hermes/google-calendar";

export async function POST() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { db, userId, row } = ctxResult.ctx;
  const profileName = row.profile_name ?? "aio";

  const stored = await readCredentialFromVault(db, userId, "google_calendar_token");
  if (stored) {
    try {
      const payload = JSON.parse(stored) as { refresh_token?: string; token?: string };
      const tokenToRevoke = payload.refresh_token ?? payload.token;
      if (tokenToRevoke) await revokeGoogleToken(tokenToRevoke);
    } catch (err) {
      console.error("Google Calendar disconnect: failed to parse stored token:", err);
    }
  }

  await db
    .from("hermes_credential_refs")
    .delete()
    .eq("customer_id", userId)
    .eq("key_name", "google_calendar_token");

  await deleteGoogleTokenFile(profileName);

  const { error: updateError } = await db
    .from("google_calendar_connections")
    .update({ revoked_at: new Date().toISOString() })
    .eq("customer_id", userId);
  if (updateError) {
    return Response.json(
      { error: "update_failed", message: updateError.message },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
