// Hermes orchestrator supervisor (Step 3b — BUILD_SPEC §4/§5, Q14, Q39).
//
// Next.js has no persistent background-worker primitive, so Phase-1 local
// dev uses a small long-lived Node process started alongside `npm run dev`:
//   - on startup: crash-reconcile (Q39 must-have — mark running/idle rows
//     with a dead PID as 'failed')
//   - every IDLE_SWEEP_INTERVAL_MS: idle-kill sweep (Q14, ~60min threshold)
//
// Run with: npm run hermes:supervisor  (or alongside dev, see package.json).
// Requires .env.local for Supabase service-role credentials — load via
// `node --env-file` or dotenv since this runs outside the Next.js runtime.

import { reconcileCrashedProcesses } from "../src/lib/hermes/provision";
import { idleKillSweep, } from "../src/lib/hermes/lifecycle";
import { serviceDb } from "../src/lib/hermes/registry";

const IDLE_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // check every 5 min for ~60min idle timeout

async function main() {
  const db = serviceDb();

  const reconciled = await reconcileCrashedProcesses(db);
  console.log(`[hermes-supervisor] startup crash-reconcile: ${reconciled} row(s) marked failed`);

  const sweep = async () => {
    try {
      const killed = await idleKillSweep(db);
      if (killed > 0) {
        console.log(`[hermes-supervisor] idle-kill sweep: ${killed} process(es) idled`);
      }
    } catch (err) {
      console.error("[hermes-supervisor] idle-kill sweep failed:", err);
    }
  };

  await sweep();
  setInterval(sweep, IDLE_SWEEP_INTERVAL_MS);

  console.log(`[hermes-supervisor] running, idle sweep every ${IDLE_SWEEP_INTERVAL_MS / 1000}s`);
}

main().catch((err) => {
  console.error("[hermes-supervisor] fatal:", err);
  process.exit(1);
});
