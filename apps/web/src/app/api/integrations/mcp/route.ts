import fs from "fs/promises";
import yaml from "yaml";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { profileDir } from "@/lib/hermes/config";

export interface McpServerStatus {
  name: string;
  transport: string;
  enabled: boolean;
}

// GET /api/integrations/mcp — real MCP server list for the user's Hermes
// profile, read straight from config.yaml `mcp_servers` (same key
// hermes_cli/mcp_config.py reads/writes via `hermes mcp add/list`). Read-only:
// writing entries goes through hermes_cli's own validate_mcp_server_entry
// security check (mcp_security.py), which Aio does not reimplement.
export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { row } = ctxResult.ctx;
  if (!row.profile_name) {
    return Response.json({ error: "no_profile", message: "Hermes profile not provisioned yet." }, { status: 503 });
  }

  const configPath = `${profileDir(row.profile_name)}/config.yaml`;

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
