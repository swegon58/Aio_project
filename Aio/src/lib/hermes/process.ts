import net from "net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROVISION_PORT_RANGE } from "./config";
import { getAllPorts } from "./registry";

// Returns true if a TCP port is free on localhost (no listener).
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

// Scans PROVISION_PORT_RANGE for a port not already claimed in the registry
// AND actually free on the host. Step 3b §4 step 4.
export async function allocateFreePort(db: SupabaseClient): Promise<number> {
  const used = new Set(await getAllPorts(db));
  const [start, end] = PROVISION_PORT_RANGE;
  for (let port = start; port <= end; port++) {
    if (used.has(port)) continue;
    if (await isPortFree(port)) return port;
  }
  throw new Error(
    `No free port available in range ${start}-${end} (Phase-1 concurrent-process cap, Q35)`,
  );
}

// Checks whether a process with the given PID is alive. Used for crash
// reconcile (Q39) — a registry row marked running/idle whose PID is dead
// means the process crashed without updating its own status.
export function isPidAlive(pid: number | null | undefined): boolean {
  if (!pid) return false;
  try {
    // Signal 0 does not kill — it only checks existence/permission.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
