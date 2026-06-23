import fs from "fs/promises";
import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { profileEnvPath } from "@/lib/hermes/config";
import { findPlatform } from "@/lib/hermes/platforms";

// POST /api/connections/token — write/update one platform's token line in
// profiles/<name>/.env (flat KEY=value convention, same file
// writeProfileEnv() in lib/hermes/provision.ts produces). Does not restart
// the gateway — a running gateway only reads .env at process start, so the
// new token takes effect on the next manual restart.
export async function POST(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row } = ctxResult.ctx;

  const { platform, token }: { platform?: string; token?: string } = await req.json();
  if (!platform || typeof token !== "string" || !token.trim()) {
    return Response.json(
      { error: "missing_fields", message: "platform and token are required" },
      { status: 400 },
    );
  }

  const platformDef = findPlatform(platform);
  if (!platformDef) {
    return Response.json(
      { error: "unknown_platform", message: `Unknown platform "${platform}"` },
      { status: 400 },
    );
  }

  const profileName = row.profile_name ?? "aio";
  const envPath = profileEnvPath(profileName);

  let envRaw = "";
  try {
    envRaw = await fs.readFile(envPath, "utf-8");
  } catch {
    // No .env yet — start fresh.
  }

  const tokenValue = token.trim();
  const linePattern = new RegExp(`^${platformDef.tokenEnvVar}=.*$`, "m");
  const newLine = `${platformDef.tokenEnvVar}=${tokenValue}`;

  let updated: string;
  if (linePattern.test(envRaw)) {
    updated = envRaw.replace(linePattern, newLine);
  } else {
    const sep = envRaw.length > 0 && !envRaw.endsWith("\n") ? "\n" : "";
    updated = `${envRaw}${sep}${newLine}\n`;
  }

  await fs.writeFile(envPath, updated, "utf-8");

  return Response.json({
    ok: true,
    platform: platformDef.id,
    profileName,
    restartRequired: true,
  });
}

// DELETE /api/connections/token — clear one platform's token line from
// profiles/<name>/.env. Same restart caveat as POST applies.
export async function DELETE(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row } = ctxResult.ctx;

  const { platform }: { platform?: string } = await req.json();
  if (!platform) {
    return Response.json(
      { error: "missing_fields", message: "platform is required" },
      { status: 400 },
    );
  }

  const platformDef = findPlatform(platform);
  if (!platformDef) {
    return Response.json(
      { error: "unknown_platform", message: `Unknown platform "${platform}"` },
      { status: 400 },
    );
  }

  const profileName = row.profile_name ?? "aio";
  const envPath = profileEnvPath(profileName);

  let envRaw = "";
  try {
    envRaw = await fs.readFile(envPath, "utf-8");
  } catch {
    return Response.json({ ok: true, platform: platformDef.id, profileName, restartRequired: false });
  }

  const linePattern = new RegExp(`^${platformDef.tokenEnvVar}=.*\\n?`, "m");
  const updated = envRaw.replace(linePattern, "");
  await fs.writeFile(envPath, updated, "utf-8");

  return Response.json({
    ok: true,
    platform: platformDef.id,
    profileName,
    restartRequired: true,
  });
}
