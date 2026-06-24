// Aio Terminal — live-preview sandbox (Docker-isolated dev-server runner).
//
// Additive, standalone module. Does NOT touch apps/harness/hermes-agent core
// and does NOT modify the existing per-customer gateway provisioning flow in
// provision.ts — it only reuses the port-freeness check from process.ts.
//
// Architecture (locked decision, see task brief — OpenHands-style, NOT
// wildcard DNS / NOT a cloud sandbox provider like E2B/Daytona):
//   - One Docker container per session, started on demand via
//     `startPreview(sessionId, dir)`.
//   - The container mounts the session's generated-code directory read-write
//     at /workspace, runs `npm install` (if needed) then the app's dev/start
//     script, and binds the dev server to a single host port drawn from the
//     small fixed PREVIEW_PORT_RANGE pool (config.ts).
//   - A Next.js API route (apps/web/src/app/api/preview/[sessionId]/...)
//     reverse-proxies /api/preview/<sessionId>/* to
//     http://127.0.0.1:<assigned-port>/* — see that route for the proxy
//     implementation. No system-level nginx/Caddy change required for v1;
//     a config snippet is documented below for anyone who wants to front
//     this with a real reverse proxy instead.
//   - Lifecycle is tracked in an in-memory Map (v1 — no Supabase persistence;
//     a single Next.js server process is the deployment target per
//     apps/web/CLAUDE.md, so in-memory state surviving for the life of that
//     process is an acceptable Phase-1 tradeoff, same spirit as the
//     in-memory bits already in this lib). `stopPreview` tears a session
//     down explicitly; `process.on("exit"/"SIGTERM"/"SIGINT")` hooks below
//     best-effort-kill every tracked container if the host process itself
//     dies, since nothing in this repo had an existing exit-hook pattern to
//     follow (lifecycle.ts's idle-kill is a polled sweep, not an exit hook).
//
// TODO (v2, out of scope here): non-Node runtimes (Python/etc). Detect via
// requirements.txt / pyproject.toml and pick a different base image +
// start command. Not implemented — Node-only for v1 per task brief.
//
// ---------------------------------------------------------------------------
// Reverse-proxy alternative (documented, not wired): if you'd rather have
// the system reverse proxy (nginx/Caddy) handle this instead of the Next.js
// API route below, the equivalent Caddy snippet is:
//
//   handle_path /preview/<sessionId>/* {
//     reverse_proxy 127.0.0.1:<assigned-port>
//   }
//
// or nginx:
//
//   location /preview/<sessionId>/ {
//     proxy_pass http://127.0.0.1:<assigned-port>/;
//     proxy_http_version 1.1;
//     proxy_set_header Upgrade $http_upgrade;
//     proxy_set_header Connection "upgrade";
//   }
//
// Both require a config reload per new session, which is why the Next.js API
// route (no reload needed, ports resolved per-request from the in-memory
// map) is the v1 choice.
// ---------------------------------------------------------------------------

import { spawn, type ChildProcess } from "child_process";
import fs from "fs/promises";
import path from "path";
import { PREVIEW_PORT_RANGE } from "./config";
import { isPortFree } from "./process";

export interface PreviewSession {
  sessionId: string;
  dir: string;
  port: number;
  containerName: string;
  /** Host PID of the `docker run` wrapper process (not the in-container PID). */
  pid: number | null;
  startedAt: number;
  /** Resolves once the dev server inside the container responds, or rejects on timeout. */
  status: "starting" | "running" | "failed" | "stopped";
}

const DOCKER_BIN = "docker";
const NODE_IMAGE = "node:20-bookworm-slim";
const READY_TIMEOUT_MS = 90_000;
const READY_POLL_MS = 1_000;

// In-memory session registry — v1, see module header. Keyed by sessionId;
// only one live preview container per session at a time.
const sessions = new Map<string, PreviewSession>();

function containerNameFor(sessionId: string): string {
  // Docker container names: [a-zA-Z0-9][a-zA-Z0-9_.-]* — sanitize sessionId
  // defensively in case it ever contains anything else.
  const safe = sessionId.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `aio-preview-${safe}`;
}

function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

// Scans PREVIEW_PORT_RANGE for a port that's both free on the host AND not
// already claimed by another tracked session (in-memory only — see module
// header re: no Supabase-backed registry for this pool in v1).
async function allocatePreviewPort(): Promise<number> {
  const claimed = new Set(Array.from(sessions.values()).map((s) => s.port));
  const [start, end] = PREVIEW_PORT_RANGE;
  for (let port = start; port <= end; port++) {
    if (claimed.has(port)) continue;
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `No free preview port available in range ${start}-${end} (PREVIEW_PORT_RANGE concurrent-preview cap)`,
  );
}

// Detects the app's dev-server start command from package.json. Prefers
// `dev`, falls back to `start`. v1 assumption (per task brief): Node-based
// apps with a package.json — TODO (v2) Python/other runtimes.
async function resolveStartCommand(dir: string): Promise<string> {
  const pkgPath = path.join(dir, "package.json");
  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
  } catch {
    throw new Error(
      `preview-sandbox: no package.json found in ${dir} — only Node apps with a dev/start script are supported in v1`,
    );
  }
  const scripts = pkg.scripts ?? {};
  if (scripts.dev) return "npm run dev";
  if (scripts.start) return "npm run start";
  throw new Error(
    `preview-sandbox: package.json in ${dir} has no "dev" or "start" script`,
  );
}

// Polls the container's bound port until something answers on HTTP, or
// times out. We don't assume a specific health endpoint — generated apps
// won't have one — so "any HTTP response" (even a 404) counts as ready.
async function waitUntilReady(port: number): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) });
      return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
  }
  throw new Error(`Preview dev server on port ${port} did not become ready within ${READY_TIMEOUT_MS}ms`);
}

/**
 * Starts a Docker-isolated dev server for a session's generated code and
 * returns a stable local preview URL once the dev server responds.
 *
 * Contract for the hermes-agent tool-calling loop (wiring into
 * apps/harness is a follow-up — NOT done here, see task brief item 5):
 *
 *   start_preview(sessionId: string, dir: string) -> { previewUrl: string }
 *
 * - `sessionId`: the Aio chat/task session id (used as the container name +
 *   the in-memory map key + the proxy path segment).
 * - `dir`: absolute host path to the directory containing the generated
 *   Node app (must have a package.json with a `dev` or `start` script).
 * - Returns a same-origin URL (`/api/preview/<sessionId>/`) that the Aio
 *   Terminal UI panel can iframe directly — no CORS/mixed-content issues
 *   since it's proxied through the existing Next.js host.
 *
 * Idempotent: calling again for a sessionId that already has a running
 * container returns the existing preview URL without restarting it.
 */
export async function startPreview(
  sessionId: string,
  dir: string,
): Promise<{ previewUrl: string; port: number }> {
  const existing = sessions.get(sessionId);
  if (existing && existing.status === "running") {
    return { previewUrl: previewUrlFor(sessionId), port: existing.port };
  }
  if (existing && existing.status === "starting") {
    throw new Error(`preview-sandbox: session ${sessionId} is already starting`);
  }

  const startCmd = await resolveStartCommand(dir);
  const port = await allocatePreviewPort();
  const containerName = containerNameFor(sessionId);

  // Best-effort cleanup of any stale container with the same name (e.g. a
  // crashed previous run that left the container behind in "exited" state —
  // `docker run --name` fails if a stopped container with that name exists).
  await run(DOCKER_BIN, ["rm", "-f", containerName]).catch(() => {});

  const session: PreviewSession = {
    sessionId,
    dir,
    port,
    containerName,
    pid: null,
    startedAt: Date.now(),
    status: "starting",
  };
  sessions.set(sessionId, session);

  // Single shell command inside the container: install deps (if
  // node_modules missing) then run the resolved start command. Using `sh -c`
  // keeps this to one `docker run` invocation instead of separate
  // install/run steps.
  const containerCmd = `[ -d node_modules ] || npm install; exec ${startCmd}`;

  const dockerArgs = [
    "run",
    "--rm",
    "--name",
    containerName,
    "-p",
    `${port}:3000`,
    "-v",
    `${dir}:/workspace`,
    "-w",
    "/workspace",
    "-e",
    "HOST=0.0.0.0",
    "-e",
    "PORT=3000",
    NODE_IMAGE,
    "sh",
    "-c",
    containerCmd,
  ];

  const child = spawn(DOCKER_BIN, dockerArgs, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  session.pid = child.pid ?? null;

  child.on("exit", () => {
    const current = sessions.get(sessionId);
    if (current && current.status !== "stopped") {
      current.status = "failed";
    }
  });

  try {
    await waitUntilReady(port);
  } catch (err) {
    session.status = "failed";
    await stopPreview(sessionId).catch(() => {});
    throw err;
  }

  session.status = "running";
  return { previewUrl: previewUrlFor(sessionId), port };
}

// Same-origin path the Next.js proxy route listens on — see
// apps/web/src/app/api/preview/[sessionId]/[[...path]]/route.ts.
export function previewUrlFor(sessionId: string): string {
  return `/api/preview/${encodeURIComponent(sessionId)}/`;
}

/** Looks up a session's tracked state without mutating anything. */
export function getPreviewSession(sessionId: string): PreviewSession | undefined {
  return sessions.get(sessionId);
}

export function listPreviewSessions(): PreviewSession[] {
  return Array.from(sessions.values());
}

/**
 * Stops and removes the container for a session (idempotent — no-op if the
 * session isn't tracked or is already stopped) and releases its port.
 */
export async function stopPreview(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.status = "stopped";
  await run(DOCKER_BIN, ["rm", "-f", session.containerName]).catch(() => {});
  sessions.delete(sessionId);
}

/** Kills every tracked container — used by the exit hooks below and available for an admin/ops sweep. */
export async function stopAllPreviews(): Promise<void> {
  await Promise.all(Array.from(sessions.keys()).map((id) => stopPreview(id)));
}

// Orphan cleanup: best-effort synchronous-ish kill of every tracked
// container if the host Next.js process exits (crash, restart, deploy).
// There was no pre-existing exit-hook pattern in this lib to follow
// (lifecycle.ts's idle-kill is a polled sweep, not a process exit hook), so
// this is new. `docker rm -f` is fire-and-forget here since async work
// inside "exit" handlers isn't guaranteed to complete — SIGTERM/SIGINT
// handlers below get a real async chance to run first.
function killAllContainersSync(): void {
  for (const session of sessions.values()) {
    try {
      spawn(DOCKER_BIN, ["rm", "-f", session.containerName], { stdio: "ignore" }).unref();
    } catch {
      // best effort
    }
  }
}

let exitHooksInstalled = false;
export function installPreviewExitHooks(): void {
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;
  process.on("exit", killAllContainersSync);
  process.on("SIGTERM", () => {
    stopAllPreviews().finally(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    stopAllPreviews().finally(() => process.exit(0));
  });
}

// Install eagerly on module load — mirrors "additive, self-contained" intent
// (nothing else needs to remember to call this for cleanup to work).
installPreviewExitHooks();

/**
 * Tool contract stub for hermes-agent's tool-calling loop (task brief item
 * 5). NOT wired into apps/harness here — that's a follow-up. This is the
 * shape an agent tool definition would call through to.
 *
 * JSON-schema-ish contract for the tool-calling layer:
 *   name: "start_preview"
 *   description: "Start (or reuse) a live preview of the web app the agent
 *     just generated, returning an iframe-able URL."
 *   parameters:
 *     sessionId: string — current task/session id
 *     dir: string — absolute path to the generated app's directory
 *   returns: { previewUrl: string }
 */
export async function startPreviewTool(args: {
  sessionId: string;
  dir: string;
}): Promise<{ previewUrl: string }> {
  const { previewUrl } = await startPreview(args.sessionId, args.dir);
  return { previewUrl };
}
