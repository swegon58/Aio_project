import { spawn } from "child_process";
import path from "path";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { HERMES_HARNESS_ROOT, profileDir, profileHomeDir } from "@/lib/hermes/config";

// memory_summary.py is a standalone helper (Aio_harness/aio-home/scripts/),
// not part of hermes-agent core. It loads the profile's Honcho config the
// same way the `hermes` CLI does (load_hermes_dotenv) and fetches:
//   - session.context(summary=True) -> a real Honcho-generated AI summary,
//     when Honcho has produced one for this session
//   - peer.get_card() -> raw structured facts (no LLM reasoning), capped to 10
// No SDK call exists that returns an always-on "summary of everything we
// know about this user" distinct from the session-scoped summary above, so
// the UI must label facts honestly as recent memory, not an AI summary.
const VENV_PYTHON = path.join(
  HERMES_HARNESS_ROOT,
  "hermes-agent",
  ".venv",
  "bin",
  "python3",
);
const SCRIPT_PATH = path.join(
  HERMES_HARNESS_ROOT,
  "aio-home",
  "scripts",
  "memory_summary.py",
);

function run(
  cmd: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export async function GET() {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { userId, row } = ctxResult.ctx;

  const profileName = row.profile_name ?? "aio";

  const result = await run(VENV_PYTHON, [SCRIPT_PATH, userId], {
    HERMES_HOME: profileDir(profileName),
    HOME: profileHomeDir(profileName),
  });

  if (result.code !== 0) {
    return Response.json(
      { available: false, error: result.stderr || "memory_summary.py failed" },
      { status: 502 },
    );
  }

  try {
    const data = JSON.parse(result.stdout.trim() || "{}");
    return Response.json(data);
  } catch {
    return Response.json(
      { available: false, error: "Failed to parse memory summary output" },
      { status: 502 },
    );
  }
}
