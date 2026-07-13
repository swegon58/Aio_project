import { spawn } from "child_process";
import { HERMES_BIN, hermesSpawnEnv } from "./config";
import type { HermesCliResult } from "./mcp-cli";

// Runs `hermes -p <profileName> skills <...args>` non-interactively. All
// validation (skills_guard.py's scan_skill/should_allow_install, config
// storage in skills_config.py, tier/toolset gating on subsequent spawns)
// lives in hermes_cli — this is a thin subprocess bridge only, no
// re-implementation of that logic here. Same shape as `runHermesMcp`.
export function runHermesSkills(profileName: string, args: string[]): Promise<HermesCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(HERMES_BIN, ["-p", profileName, "skills", ...args], {
      env: { ...process.env, ...hermesSpawnEnv(profileName) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end();
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}
