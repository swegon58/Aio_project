// R10.1: Google OAuth callback — exchanges the auth code, writes the token
// bridge file into the customer's Hermes profile, and records the
// connection. See src/app/api/connections/google/start/route.ts for the
// state cookie this validates against.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { storeCredentialInVault } from "@/lib/hermes/registry";
import {
  buildAuthorizedUserPayload,
  exchangeCodeForTokens,
  fetchGoogleEmail,
  googleOAuthConfigured,
  writeGoogleTokenFile,
} from "@/lib/hermes/google-calendar";
import { STATE_COOKIE } from "@/app/api/connections/google/start/route";

function redirectWithStatus(req: NextRequest, status: "connected" | "error", detail?: string) {
  const url = new URL("/", req.url);
  url.searchParams.set("google_calendar", status);
  if (detail) url.searchParams.set("google_calendar_detail", detail);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  if (!googleOAuthConfigured()) {
    return Response.json(
      { error: "not_configured", message: "Google Calendar connect is not configured yet." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    return redirectWithStatus(req, "error", "denied");
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus(req, "error", "invalid_state");
  }

  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { db, userId, row } = ctxResult.ctx;
  const profileName = row.profile_name ?? "aio";

  try {
    const redirectUri = new URL("/api/connections/google/callback", req.url).toString();
    const tokenResponse = await exchangeCodeForTokens(code, redirectUri);
    const refreshToken = tokenResponse.refresh_token;
    if (!refreshToken) {
      return redirectWithStatus(req, "error", "no_refresh_token");
    }

    const googleEmail = await fetchGoogleEmail(tokenResponse.access_token);
    const payload = buildAuthorizedUserPayload(tokenResponse, refreshToken);

    await writeGoogleTokenFile(profileName, payload);
    await storeCredentialInVault(db, userId, "google_calendar_token", JSON.stringify(payload));

    const grantedScopes = tokenResponse.scope.split(" ").filter(Boolean);
    const { error: upsertError } = await db
      .from("google_calendar_connections")
      .upsert(
        {
          customer_id: userId,
          google_email: googleEmail,
          granted_scopes: grantedScopes,
          connected_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "customer_id" },
      );
    if (upsertError) throw new Error(`google_calendar_connections upsert failed: ${upsertError.message}`);

    return redirectWithStatus(req, "connected");
  } catch (err) {
    console.error("Google Calendar OAuth callback failed:", err);
    return redirectWithStatus(req, "error", "exchange_failed");
  }
}
