// In-process sliding-window abuse tracker for repeated prompt-injection
// pattern hits (threat-patterns.ts). In-memory by design — Phase 1 runs a
// single local Hermes/Next.js process (see Aio_harness/CLAUDE.md), so a
// module-level Map persists for the process lifetime. Revisit with a
// shared store (Redis/Supabase) before a multi-instance/serverless deploy.

interface Window {
  hits: number[]; // epoch ms of each threat-pattern hit
}

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BLOCK_THRESHOLD = 3; // hits within window before soft-blocking

const windows = new Map<string, Window>();

// Returns true if this userId should be soft-blocked (too many
// injection-pattern hits in the trailing window). Always records the hit.
export function recordThreatHitAndCheckBlock(userId: string): boolean {
  const now = Date.now();
  const w = windows.get(userId) ?? { hits: [] };
  w.hits = w.hits.filter((t) => now - t < WINDOW_MS);
  w.hits.push(now);
  windows.set(userId, w);
  return w.hits.length >= BLOCK_THRESHOLD;
}
