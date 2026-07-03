// R10.1: Google Calendar connection status — read by the Settings UI to
// render the connect/disconnect card.

import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { googleOAuthConfigured } from "@/lib/hermes/google-calendar";

export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { db, userId } = ctxResult.ctx;

  const { data, error } = await db
    .from("google_calendar_connections")
    .select("google_email, granted_scopes, connected_at, revoked_at")
    .eq("customer_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "lookup_failed", message: error.message }, { status: 500 });
  }

  const connected = Boolean(data && !data.revoked_at);

  return Response.json({
    configured: googleOAuthConfigured(),
    connected,
    googleEmail: connected ? data!.google_email : null,
    grantedScopes: connected ? data!.granted_scopes : [],
    connectedAt: connected ? data!.connected_at : null,
  });
}
