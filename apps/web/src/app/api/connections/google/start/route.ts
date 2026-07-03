// R10.1: kicks off the Google Calendar OAuth flow — redirects the browser to
// Google's consent screen. See src/lib/hermes/google-calendar.ts for the
// token exchange side (callback route) and the profile token-file bridge.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { buildGoogleAuthUrl, googleOAuthConfigured } from "@/lib/hermes/google-calendar";

export const STATE_COOKIE = "google_oauth_state";

export async function GET(req: NextRequest) {
  if (!googleOAuthConfigured()) {
    return Response.json(
      { error: "not_configured", message: "Google Calendar connect is not configured yet." },
      { status: 503 },
    );
  }

  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/connections/google/callback", req.url).toString();
  const authUrl = buildGoogleAuthUrl(redirectUri, state);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/connections/google",
    maxAge: 600,
  });

  return NextResponse.redirect(authUrl);
}
