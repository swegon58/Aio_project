import { spawn } from "child_process";
import { HERMES_BIN, hermesSpawnEnv } from "./config";

export interface HermesCliResult {
  code: number;
  stdout: string;
  stderr: string;
}

// Runs `hermes -p <profileName> mcp <...args>` non-interactively. All
// validation (manifest checks, mcp_security.py's validate_mcp_server_entry,
// tier/toolset gating on subsequent spawns) lives in hermes_cli — this is a
// thin subprocess bridge only, no re-implementation of that logic here.
//
// stdin is closed immediately: hermes_cli's prompt() helper (cli_output.py)
// treats a closed stdin as EOFError and returns "" rather than blocking, but
// only if the pipe is actually closed — Node's default `spawn` stdio leaves
// it open, which would hang a request against any command that still calls
// input() on an unexpected path.
export function runHermesMcp(profileName: string, args: string[]): Promise<HermesCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(HERMES_BIN, ["-p", profileName, "mcp", ...args], {
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
