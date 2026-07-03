import fs from "fs/promises";
import path from "path";
import { profileDir } from "@/lib/hermes/config";

// R10.1: Google Calendar connect flow. Web-side OAuth (authorization code +
// client secret exchange) happens here in Next.js; the customer's Hermes
// profile never sees the client secret, only the resulting per-user
// "authorized_user" token file the google-workspace skill already knows how
// to read (see setup.py's TOKEN_PATH / Credentials.from_authorized_user_file).

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
] as const;

const GOOGLE_AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URI = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URI = "https://www.googleapis.com/oauth2/v3/userinfo";

// Filename the google-workspace skill's setup.py expects at the profile's
// HERMES_HOME root (`profiles/<name>/google_token.json`) — see
// TOKEN_PATH = get_hermes_home() / "google_token.json" in setup.py.
const TOKEN_FILENAME = "google_token.json";

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

function requireOAuthEnv(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured (GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET unset)");
  }
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = requireOAuthEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    // Forces a fresh refresh_token on every connect, including reconnects —
    // Google only issues one on the very first grant otherwise.
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URI}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireOAuthEnv();
  const res = await fetch(GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<GoogleTokenResponse>;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URI, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo lookup failed (${res.status})`);
  }
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("Google userinfo response had no email");
  return data.email;
}

// Builds the "authorized_user" JSON shape python's google-auth library
// (Credentials.from_authorized_user_file) expects — the same shape the
// google-workspace skill's setup.py writes after its own CLI-driven flow.
export function buildAuthorizedUserPayload(
  tokenResponse: GoogleTokenResponse,
  refreshToken: string,
): Record<string, unknown> {
  const { clientId, clientSecret } = requireOAuthEnv();
  return {
    type: "authorized_user",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    token: tokenResponse.access_token,
    token_uri: GOOGLE_TOKEN_URI,
    scopes: tokenResponse.scope.split(" ").filter(Boolean),
    expiry: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
  };
}

export async function writeGoogleTokenFile(profileName: string, tokenPayload: object): Promise<void> {
  const filePath = path.join(profileDir(profileName), TOKEN_FILENAME);
  await fs.writeFile(filePath, JSON.stringify(tokenPayload, null, 2), "utf-8");
  await fs.chmod(filePath, 0o600);
}

export async function deleteGoogleTokenFile(profileName: string): Promise<void> {
  const filePath = path.join(profileDir(profileName), TOKEN_FILENAME);
  await fs.rm(filePath, { force: true });
}

// Best-effort revoke against Google's real revoke endpoint. Must be called
// BEFORE clearing our own vault ref / connection row — clearing our side
// alone does not revoke the Google-side grant.
export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(GOOGLE_REVOKE_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch (err) {
    console.error("Google token revoke request failed:", err);
  }
}
