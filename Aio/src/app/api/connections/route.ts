import fs from "fs/promises";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { profileEnvPath } from "@/lib/hermes/config";
import { KNOWN_PLATFORMS } from "@/lib/hermes/platforms";

// GET /api/connections — read-only platform connection status for the
// signed-in customer's Hermes profile. "Connected" means the platform's
// token env var is present and non-empty in profiles/<name>/.env — this
// does NOT start/stop any adapter or contact the platform API.
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row } = ctxResult.ctx;

  const profileName = row.profile_name ?? "aio";

  let envRaw = "";
  try {
    envRaw = await fs.readFile(profileEnvPath(profileName), "utf-8");
  } catch {
    // No .env yet — every platform reports as not connected.
  }

  const platforms = KNOWN_PLATFORMS.map((p) => {
    const match = envRaw.match(new RegExp(`^${p.tokenEnvVar}=(.*)$`, "m"));
    const connected = Boolean(match?.[1]?.trim());
    return {
      id: p.id,
      label: p.label,
      tokenEnvVar: p.tokenEnvVar,
      connected,
    };
  });

  return Response.json({ profileName, platforms });
}
