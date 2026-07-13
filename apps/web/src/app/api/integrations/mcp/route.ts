import fs from "fs/promises";
import yaml from "yaml";
import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { profileDir } from "@/lib/hermes/config";
import { runHermesMcp } from "@/lib/hermes/mcp-cli";

export interface McpServerStatus {
  name: string;
  transport: string;
  enabled: boolean;
}

// Shared tenant boundary for every handler below: resolves the caller's own
// Hermes profile (never client-supplied) or the same "not provisioned yet"
// error the GET handler already used.
async function resolveProfile(): Promise<
  { ok: true; profileName: string } | { ok: false; res: Response }
> {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return { ok: false, res: ctxResult.res };
  const { row } = ctxResult.ctx;
  if (!row.profile_name) {
    return {
      ok: false,
      res: Response.json({ error: "no_profile", message: "Hermes profile not provisioned yet." }, { status: 503 }),
    };
  }
  return { ok: true, profileName: row.profile_name };
}

// GET /api/integrations/mcp — real MCP server list for the user's Hermes
// profile, read straight from config.yaml `mcp_servers` (same key
// hermes_cli/mcp_config.py reads/writes via `hermes mcp add/list`).
//
// Writes (POST/PATCH/DELETE below) all shell out to `hermes mcp ...` — every
// manifest/security check (mcp_security.py's validate_mcp_server_entry, auth
// type handling, etc.) lives in hermes_cli and is not reimplemented here.
export async function GET() {
  const profileResult = await resolveProfile();
  if (!profileResult.ok) return profileResult.res;

  const configPath = `${profileDir(profileResult.profileName)}/config.yaml`;

  let servers: McpServerStatus[] = [];
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const parsed = yaml.parse(raw) as Record<string, unknown> | null;
    const mcpServers = (parsed?.mcp_servers ?? {}) as Record<string, Record<string, unknown>>;
    servers = Object.entries(mcpServers).map(([name, cfg]) => {
      const transport =
        typeof cfg.url === "string"
          ? cfg.url
          : typeof cfg.command === "string"
            ? [cfg.command, ...(Array.isArray(cfg.args) ? cfg.args : [])].join(" ")
            : "?";
      const enabled = typeof cfg.enabled === "boolean" ? cfg.enabled : cfg.enabled !== "false";
      return { name, transport, enabled };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "config_read_failed", message: msg }, { status: 500 });
  }

  return Response.json({ servers });
}

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// POST /api/integrations/mcp — install a catalog entry: `hermes mcp install
// <name> [--env K=V ...]`. `env` is optional pre-seeded credentials (only
// keys the manifest's `auth.env` declares are actually written — see
// mcp_catalog.py's `_apply_env_overrides`); anything else in the request
// body's `env` map is just ignored by hermes_cli, not an Aio-side allowlist.
export async function POST(req: NextRequest) {
  const profileResult = await resolveProfile();
  if (!profileResult.ok) return profileResult.res;

  const { name, env }: { name?: string; env?: Record<string, string> } = await req.json();
  if (!name || typeof name !== "string") {
    return Response.json({ error: "missing_name", message: "name is required" }, { status: 400 });
  }

  const envArgs: string[] = [];
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (!ENV_KEY_RE.test(key) || typeof value !== "string") {
        return Response.json({ error: "invalid_env", message: `Invalid env key "${key}"` }, { status: 400 });
      }
      envArgs.push(`${key}=${value}`);
    }
  }

  const args = ["install", name, ...(envArgs.length ? ["--env", ...envArgs] : [])];
  const result = await runHermesMcp(profileResult.profileName, args);
  if (result.code !== 0) {
    return Response.json(
      { error: "install_failed", message: (result.stdout + result.stderr).trim() || "hermes mcp install failed" },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, name });
}

// PATCH /api/integrations/mcp — enable/disable an already-installed server:
// `hermes mcp enable|disable <name>`.
export async function PATCH(req: NextRequest) {
  const profileResult = await resolveProfile();
  if (!profileResult.ok) return profileResult.res;

  const { name, enabled }: { name?: string; enabled?: boolean } = await req.json();
  if (!name || typeof name !== "string" || typeof enabled !== "boolean") {
    return Response.json(
      { error: "missing_fields", message: "name and enabled are required" },
      { status: 400 },
    );
  }

  const result = await runHermesMcp(profileResult.profileName, [enabled ? "enable" : "disable", name]);
  if (result.code !== 0) {
    return Response.json(
      { error: "toggle_failed", message: (result.stdout + result.stderr).trim() || "hermes mcp enable/disable failed" },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, name, enabled });
}

// DELETE /api/integrations/mcp — remove a server: `hermes mcp remove <name>`.
// `cmd_mcp_remove`'s confirmation prompt defaults to "yes" on EOFError
// (headless stdin), so this is safe to call non-interactively.
export async function DELETE(req: NextRequest) {
  const profileResult = await resolveProfile();
  if (!profileResult.ok) return profileResult.res;

  const { name }: { name?: string } = await req.json();
  if (!name || typeof name !== "string") {
    return Response.json({ error: "missing_name", message: "name is required" }, { status: 400 });
  }

  const result = await runHermesMcp(profileResult.profileName, ["remove", name]);
  if (result.code !== 0) {
    return Response.json(
      { error: "remove_failed", message: (result.stdout + result.stderr).trim() || "hermes mcp remove failed" },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, name });
}
