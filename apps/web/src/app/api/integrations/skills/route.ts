import { NextRequest } from "next/server";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { runHermesSkills } from "@/lib/hermes/skill-cli";

export interface SkillStatus {
  name: string;
  category: string;
  description: string;
  source: "hub" | "builtin" | "local";
  trust: string;
  enabled: boolean;
}

// Shared tenant boundary for every handler below: resolves the caller's own
// Hermes profile (never client-supplied) or the same "not provisioned yet"
// error every handler uses. Same shape as api/integrations/mcp's resolveProfile.
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

// GET /api/integrations/skills — installed skill list for the user's Hermes
// profile, via `hermes skills list --json`. Unlike MCP's config.yaml read,
// installed-skill discovery (frontmatter parsing, platform/env filtering,
// hub/builtin/local classification) is too complex to duplicate here, so
// this shells out and parses stdout rather than reading raw config.
//
// Writes (POST/PATCH below) all shell out to `hermes skills ...` — every
// scan/security check (skills_guard.py's scan_skill/should_allow_install)
// lives in hermes_cli and is not reimplemented here.
export async function GET() {
  const profileResult = await resolveProfile();
  if (!profileResult.ok) return profileResult.res;

  const result = await runHermesSkills(profileResult.profileName, ["list", "--json"]);
  if (result.code !== 0) {
    return Response.json(
      { error: "list_failed", message: (result.stdout + result.stderr).trim() || "hermes skills list failed" },
      { status: 500 },
    );
  }

  let skills: SkillStatus[] = [];
  try {
    skills = (JSON.parse(result.stdout).skills ?? []) as SkillStatus[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "list_parse_failed", message: msg }, { status: 500 });
  }

  return Response.json({ skills });
}

// POST /api/integrations/skills — install from the marketplace: `hermes
// skills install <identifier> [--category ...] [--name ...] --yes [--force]`.
// `--yes` is always passed (skip_confirm) since this is a non-interactive
// caller; `--force` opts past a blocked scan verdict, same as the CLI flag.
export async function POST(req: NextRequest) {
  const profileResult = await resolveProfile();
  if (!profileResult.ok) return profileResult.res;

  const { identifier, category, name, force }: {
    identifier?: string;
    category?: string;
    name?: string;
    force?: boolean;
  } = await req.json();
  if (!identifier || typeof identifier !== "string") {
    return Response.json({ error: "missing_identifier", message: "identifier is required" }, { status: 400 });
  }

  const args = [
    "install",
    identifier,
    ...(category ? ["--category", category] : []),
    ...(name ? ["--name", name] : []),
    "--yes",
    ...(force ? ["--force"] : []),
  ];
  const result = await runHermesSkills(profileResult.profileName, args);
  if (result.code !== 0) {
    return Response.json(
      { error: "install_failed", message: (result.stdout + result.stderr).trim() || "hermes skills install failed" },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, identifier });
}

// PATCH /api/integrations/skills — enable/disable an installed skill:
// `hermes skills enable|disable <name>`.
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

  const result = await runHermesSkills(profileResult.profileName, [enabled ? "enable" : "disable", name]);
  if (result.code !== 0) {
    return Response.json(
      { error: "toggle_failed", message: (result.stdout + result.stderr).trim() || "hermes skills enable/disable failed" },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, name, enabled });
}
