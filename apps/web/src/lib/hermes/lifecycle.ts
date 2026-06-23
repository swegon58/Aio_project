import type { SupabaseClient } from "@supabase/supabase-js";
import { IDLE_TIMEOUT_MS } from "./config";
import {
  type HermesRegistryRow,
  getRunningRows,
  updateRegistryRow,
} from "./registry";
import { isPidAlive } from "./process";
import { provisionAndStart } from "./provision";

// Marks the registry row as touched-now (called once per request that
// proxies to the customer's Hermes process). Resets the idle clock.
export async function touchRegistryRow(
  db: SupabaseClient,
  customerId: string,
): Promise<void> {
  await updateRegistryRow(db, customerId, {
    last_active_at: new Date().toISOString(),
  });
}

// Idle-kill sweep (Q14, ~60min): finds running/idle rows whose last_active_at
// exceeds IDLE_TIMEOUT_MS, kills the process, marks status='idle'.
//
// Per Q39's defensive layer, this only kills processes with no active task —
// Phase 1 approximates "no active task" as "no proxied request in the last
// IDLE_TIMEOUT_MS", which is the same signal as the idle timer itself. A true
// in-flight-task check would require reading Hermes state.db (BUILD_SPEC §13
// open item) — not implemented here.
export async function idleKillSweep(db: SupabaseClient): Promise<number> {
  const rows = await getRunningRows(db);
  const now = Date.now();
  let killed = 0;
  for (const row of rows) {
    if (row.status !== "running") continue;
    const lastActive = new Date(row.last_active_at).getTime();
    if (now - lastActive < IDLE_TIMEOUT_MS) continue;
    if (row.pid && isPidAlive(row.pid)) {
      try {
        process.kill(row.pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
    await updateRegistryRow(db, row.customer_id, { status: "idle", pid: null });
    killed++;
  }
  return killed;
}

// Ensures the customer's Hermes process is running and healthy, respawning
// (or provisioning for the first time) if necessary. Called from the chat
// route before proxying.
export async function ensureRunning(
  db: SupabaseClient,
  row: HermesRegistryRow,
): Promise<HermesRegistryRow> {
  if (row.status === "running" && row.endpoint) {
    // Trust an already-healthy endpoint even if pid is unset — covers the
    // Step 3a seeded dev "aio" row (manually started, no pid tracked).
    if (await isEndpointHealthy(row.endpoint)) return row;
    // Endpoint unreachable but row says "running" with a tracked pid that's
    // alive — treat as transient, don't reprovision under it.
    if (isPidAlive(row.pid)) return row;
  } else if (row.status !== "provisioned" && row.status !== "idle" &&
    row.status !== "stopped" && row.status !== "failed") {
    return row;
  }

  return provisionAndStart(db, row);
}

async function isEndpointHealthy(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
