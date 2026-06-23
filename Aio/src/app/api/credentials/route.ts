import fs from "fs/promises";
import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { profileEnvPath } from "@/lib/hermes/config";
import { KNOWN_CREDENTIALS, findCredential, maskSecret } from "@/lib/hermes/credentials";
import { storeCredentialInVault, readCredentialFromVault } from "@/lib/hermes/registry";

// Same dev/prod split as resolveHermesRequestContext's own bypass branch
// (request-context.ts) — dev writes/reads the profile .env directly (Batch B
// pattern), prod uses Supabase Vault (Q41 pattern, generalized in
// migration 0006). Not exported from request-context.ts, so read directly.
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

// GET /api/credentials — masked status for every known LLM/tool credential.
// Never returns full plaintext values.
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, userId, db } = ctxResult.ctx;

  if (DEV_BYPASS) {
    const profileName = row.profile_name ?? "aio";

    let envRaw = "";
    try {
      envRaw = await fs.readFile(profileEnvPath(profileName), "utf-8");
    } catch {
      // No .env yet — every credential reports as unset.
    }

    const credentials = KNOWN_CREDENTIALS.map((c) => {
      const match = envRaw.match(new RegExp(`^${c.envVar}=(.*)$`, "m"));
      const value = match?.[1]?.trim();
      return {
        id: c.id,
        label: c.label,
        envVar: c.envVar,
        set: Boolean(value),
        masked: value ? maskSecret(value) : null,
      };
    });

    return Response.json({ mode: "dev", profileName, credentials });
  }

  const credentials = await Promise.all(
    KNOWN_CREDENTIALS.map(async (c) => {
      let value: string | null = null;
      try {
        value = await readCredentialFromVault(db, userId, c.envVar);
      } catch {
        value = null;
      }
      return {
        id: c.id,
        label: c.label,
        envVar: c.envVar,
        set: Boolean(value),
        masked: value ? maskSecret(value) : null,
      };
    }),
  );

  return Response.json({ mode: "prod", credentials });
}

// POST /api/credentials — update one credential's value. Body: { id, value }.
export async function POST(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row, userId, db } = ctxResult.ctx;

  const { id, value }: { id?: string; value?: string } = await req.json();
  if (!id || typeof value !== "string" || !value.trim()) {
    return Response.json(
      { error: "missing_fields", message: "id and value are required" },
      { status: 400 },
    );
  }

  const credentialDef = findCredential(id);
  if (!credentialDef) {
    return Response.json(
      { error: "unknown_credential", message: `Unknown credential "${id}"` },
      { status: 400 },
    );
  }

  const rawValue = value.trim();

  if (DEV_BYPASS) {
    const profileName = row.profile_name ?? "aio";
    const envPath = profileEnvPath(profileName);

    let envRaw = "";
    try {
      envRaw = await fs.readFile(envPath, "utf-8");
    } catch {
      // No .env yet — start fresh.
    }

    const linePattern = new RegExp(`^${credentialDef.envVar}=.*$`, "m");
    const newLine = `${credentialDef.envVar}=${rawValue}`;

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
      mode: "dev",
      id: credentialDef.id,
      profileName,
      masked: maskSecret(rawValue),
      restartRequired: true,
    });
  }

  try {
    await storeCredentialInVault(db, userId, credentialDef.envVar, rawValue);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "vault_store_failed", message: msg }, { status: 500 });
  }

  return Response.json({
    ok: true,
    mode: "prod",
    id: credentialDef.id,
    masked: maskSecret(rawValue),
    restartRequired: true,
  });
}
