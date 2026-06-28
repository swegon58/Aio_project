// R1.4 live repository probe (not part of the build; run with tsx against the
// local Supabase stack). Exercises every DB-backed method of the run and
// run-event repositories through the real service-role client, then asserts the
// ADR-001 §3/§4/§5/§6 contracts: state transitions, idempotent append + replay,
// ordered replay with afterSequence, run+events fetch, cursor pagination, and
// tenant isolation (RUN_NOT_FOUND for the wrong tenant). Cleans up by deleting
// the synthetic user, which cascades to its runs and events.
//
// Usage:  cd apps/web && npx tsx scripts/r1-4-repo-probe.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createServiceClient } from "../src/lib/supabase/service";
import {
  attachHermesIdentity,
  createRun,
  getRun,
  listRuns,
  markTerminal,
  requestRunCancellation,
  transitionRun,
} from "../src/lib/aio/runs/run-repository";
import {
  appendEvent,
  getRunWithEvents,
  listEvents,
} from "../src/lib/aio/runs/run-event-repository";

// Load .env.local into process.env if present (supabase JS needs URL + service
// key). When the file is absent (e.g. in a worktree that shares node_modules but
// not the gitignored env), the caller is expected to have exported the vars.
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env or .env.local");
  process.exit(2);
}

const db = createServiceClient();

const step = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  // ---- synthetic tenant (a real auth.users row the FK accepts) ----
  const email = `r1-4-probe-${Date.now()}@example.com`;
  const u = await db.auth.admin.createUser({
    email,
    password: "Sup3rSecret!12345",
    email_confirm: true,
  });
  if (u.error || !u.data.user) throw new Error(`createUser failed: ${u.error?.message}`);
  const customerId = u.data.user.id;
  const otherTenant = "00000000-0000-0000-0000-000000000000"; // never created
  console.log(`tenant: ${customerId}`);

  try {
    // ---- create + read + tenant isolation ----
    const created = await createRun(db, {
      customerId,
      threadId: "thread-A",
      mode: "chat",
      inputSummary: "probe happy path",
      reservedCredits: 1,
      metadata: { kind: "probe" },
    });
    if (!created.ok) throw new Error(`createRun failed: ${created.message}`);
    assert.ok(created.ok, "createRun should succeed");
    assert.equal(created.data.status, "queued");
    const runId = created.data.id;
    step("createRun -> queued");

    const got = await getRun(db, runId, customerId);
    assert.ok(got.ok && got.data.id === runId);
    step("getRun same tenant");

    const wrong = await getRun(db, runId, otherTenant);
    assert.ok(!wrong.ok && wrong.code === "RUN_NOT_FOUND");
    step("getRun wrong tenant -> RUN_NOT_FOUND");

    // ---- hermes identity ----
    const attached = await attachHermesIdentity(db, runId, customerId, "h-run-1", "h-sess-1");
    assert.ok(attached.ok && attached.data.hermes_run_id === "h-run-1");
    step("attachHermesIdentity");

    // ---- transition queued -> running ----
    const running = await transitionRun(db, runId, customerId, "running");
    assert.ok(running.ok && running.data.status === "running");
    assert.ok(running.data.started_at !== null, "running stamps started_at");
    step("transitionRun queued -> running");

    // idempotent self-transition: running -> running is a no-op success
    const againRunning = await transitionRun(db, runId, customerId, "running");
    assert.ok(againRunning.ok);
    step("transitionRun running -> running (idempotent)");

    // ---- events: append, idempotent replay, ordered replay ----
    const e0 = await appendEvent(db, {
      id: crypto.randomUUID(),
      runId,
      customerId,
      source: "hermes",
      payload: { type: "message.delta", runId, ts: Date.now(), delta: "hi", messageId: "m1" },
      occurredAt: Date.now(),
    });
    assert.ok(e0.ok && e0.data.inserted && e0.data.sequence === 0);
    step("appendEvent seq 0");

    const e0Id = e0.data.id;
    const e0Replay = await appendEvent(db, {
      id: e0Id, // same envelope id -> idempotent no-op
      runId,
      customerId,
      source: "hermes",
      payload: { type: "message.delta", runId, ts: Date.now(), delta: "hi", messageId: "m1" },
      occurredAt: Date.now(),
    });
    assert.ok(e0Replay.ok && !e0Replay.data.inserted && e0Replay.data.sequence === 0);
    step("appendEvent replay -> inserted:false (idempotent)");

    const e1 = await appendEvent(db, {
      id: crypto.randomUUID(),
      runId,
      customerId,
      source: "aio",
      payload: { type: "tool.started", runId, ts: Date.now(), toolCallId: "tc1", toolName: "search", label: "Search" },
      occurredAt: Date.now(),
    });
    assert.ok(e1.ok && e1.data.inserted && e1.data.sequence === 1);
    step("appendEvent seq 1");

    const all = await listEvents(db, { runId, customerId });
    assert.ok(all.ok && all.data.length === 2);
    assert.deepEqual(all.data.map((r) => r.sequence), [0, 1]);
    step("listEvents ordered [0,1]");

    const after0 = await listEvents(db, { runId, customerId, afterSequence: 0 });
    assert.ok(after0.ok && after0.data.length === 1 && after0.data[0].sequence === 1);
    step("listEvents afterSequence=0 -> [1]");

    const withEvents = await getRunWithEvents(db, runId, customerId);
    assert.ok(withEvents.ok && withEvents.data.events.length === 2);
    step("getRunWithEvents");

    // ---- mark terminal (running -> completed) ----
    const done = await markTerminal(db, runId, customerId, "completed", { actualCredits: 1 });
    assert.ok(done.ok && done.data.status === "completed");
    assert.ok(done.data.completed_at !== null, "completed stamps completed_at");
    step("markTerminal running -> completed");

    // terminal is immutable: cancel and any transition are rejected
    const cancelTerminal = await requestRunCancellation(db, runId, customerId);
    assert.ok(!cancelTerminal.ok && cancelTerminal.code === "ALREADY_TERMINAL");
    step("requestRunCancellation on terminal -> ALREADY_TERMINAL");
    const leave = await transitionRun(db, runId, customerId, "failed");
    assert.ok(!leave.ok && leave.code === "ALREADY_TERMINAL");
    step("transitionRun out of completed -> ALREADY_TERMINAL");

    // ---- invalid transition path (queued cannot skip to completed) ----
    const b = await createRun(db, { customerId, threadId: "thread-B", mode: "deep_research" });
    assert.ok(b.ok);
    const skip = await transitionRun(db, b.data.id, customerId, "completed");
    assert.ok(!skip.ok && skip.code === "INVALID_TRANSITION");
    step("transitionRun queued -> completed -> INVALID_TRANSITION");

    // cancellation happy path + idempotency (queued -> cancelling -> cancelling)
    const cancel1 = await requestRunCancellation(db, b.data.id, customerId);
    assert.ok(cancel1.ok && cancel1.data.run.status === "cancelling" && cancel1.data.noop === false);
    assert.ok(cancel1.data.run.cancel_requested_at !== null);
    step("requestRunCancellation queued -> cancelling");
    const cancel2 = await requestRunCancellation(db, b.data.id, customerId);
    assert.ok(cancel2.ok && cancel2.data.noop === true);
    step("requestRunCancellation cancelling -> cancelling (noop)");

    // ---- cursor pagination: 3 runs, limit 2 ----
    const c = await createRun(db, { customerId, threadId: "thread-C", mode: "chat" });
    const d = await createRun(db, { customerId, threadId: "thread-D", mode: "chat" });
    const e = await createRun(db, { customerId, threadId: "thread-E", mode: "chat" });
    assert.ok(c.ok && d.ok && e.ok);
    void c; void d; void e;

    const page1 = await listRuns(db, { customerId, limit: 2 });
    assert.ok(page1.ok && page1.data.runs.length === 2 && page1.data.nextCursor !== null);
    step("listRuns page 1 (2 runs, nextCursor set)");

    const page2 = await listRuns(db, { customerId, limit: 2, cursor: page1.data.nextCursor });
    assert.ok(page2.ok);
    assert.ok(page2.data.runs.length >= 1, "page 2 has remaining runs");
    step(`listRuns page 2 (${page2.data.runs.length} run(s))`);

    // no overlap between pages
    const ids1 = new Set(page1.data.runs.map((r) => r.id));
    for (const r of page2.data.runs) assert.ok(!ids1.has(r.id), "page 2 must not repeat page 1 ids");
    step("pages do not overlap");

    // bad cursor
    const bad = await listRuns(db, { customerId, limit: 2, cursor: "!!!" });
    assert.ok(!bad.ok && bad.code === "BAD_CURSOR");
    step("listRuns bad cursor -> BAD_CURSOR");

    console.log("\nALL R1.4 REPOSITORY PROBE CHECKS PASSED");
  } finally {
    // cascade: dropping the user deletes its runs and events.
    const del = await db.auth.admin.deleteUser(customerId);
    if (del.error) console.log(`cleanup warning: ${del.error.message}`);
    else console.log("cleanup: synthetic user + runs + events deleted");
  }
}

main().catch((err) => {
  console.error("\nR1.4 PROBE FAILED:", err);
  process.exit(1);
});
