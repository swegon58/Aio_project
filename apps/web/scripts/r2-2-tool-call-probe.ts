// R2.2 live tool-call probe (not part of the build; run with tsx against the
// local Supabase stack). Exercises the DB-backed tool-call recording path that
// the run orchestrator now calls on every `tool.*` event: both the high-level
// `recordToolCallEvent` entry (create + transition + missed-started recovery)
// and the low-level repository contracts (idempotent create, terminal
// immutability, invalid transition, cross-tenant isolation, ordered list).
// Cleans up by deleting the synthetic user, which cascades to its run and tool
// calls.
//
// Target: the LOCAL docker Supabase stack (kong on :54321), where migration
// 0012_aio_tool_calls.sql is applied. The main worktree's .env.local points at
// a stale cloud project that was never migrated, so run this from a worktree
// without .env.local with the local stack env exported:
//
//   cd apps/web
//   export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
//   export SUPABASE_SERVICE_ROLE_KEY=<local service_role JWT>
//   npx tsx scripts/r2-2-tool-call-probe.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createServiceClient } from "../src/lib/supabase/service";
import { createRun } from "../src/lib/aio/runs/run-repository";
import type { AioRunEvent } from "../src/lib/aio/runs/aio-run-events";
import {
  buildToolCallCreateInput,
  recordToolCallEvent,
} from "../src/lib/aio/tools/tool-call-writer";
import {
  createToolCall,
  getToolCall,
  listToolCallsForRun,
  transitionStoredToolCall,
} from "../src/lib/aio/tools/tool-call-repository";

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
  // ---- synthetic tenant + a real run row the FK accepts ----
  const email = `r2-2-probe-${Date.now()}@example.com`;
  const u = await db.auth.admin.createUser({
    email,
    password: "Sup3rSecret!12345",
    email_confirm: true,
  });
  if (u.error || !u.data.user) throw new Error(`createUser failed: ${u.error?.message}`);
  const customerId = u.data.user.id;
  const otherTenant = "00000000-0000-0000-0000-000000000000"; // never created
  console.log(`tenant: ${customerId}`);

  const run = await createRun(db, {
    customerId,
    threadId: "thread-r2-2",
    mode: "chat",
    inputSummary: "r2-2 probe",
  });
  if (!run.ok) throw new Error(`createRun failed: ${run.message}`);
  const runId = run.data.id;
  const ctx = { runId, customerId };
  const tcId = (h: string) => `${runId}:${h}`;
  const iso = () => new Date().toISOString();
  const started = (h: string, toolName: string, input?: unknown): AioRunEvent =>
    ({ type: "tool.started", runId, toolCallId: h, toolName, input, createdAt: iso() }) as AioRunEvent;
  const completed = (h: string, toolName: string, output: unknown): AioRunEvent =>
    ({ type: "tool.completed", runId, toolCallId: h, toolName, output, createdAt: iso() }) as AioRunEvent;
  const failed = (h: string, toolName: string, error: string): AioRunEvent =>
    ({ type: "tool.failed", runId, toolCallId: h, toolName, error, createdAt: iso() }) as AioRunEvent;

  try {
    // 1. recordToolCallEvent tool.started -> running; manifest snapshot + redaction
    await recordToolCallEvent(db, ctx, started("tc-1", "browser", { url: "https://example.com", password: "hunter2" }));
    const r1 = await getToolCall(db, tcId("tc-1"), customerId);
    assert.ok(r1.ok, "tc-1 should exist");
    assert.equal(r1.data.status, "running");
    assert.equal(r1.data.risk, "dangerous");
    assert.equal(r1.data.approval_policy.defaultMode, "once");
    assert.equal(r1.data.tool_label, "Browser Automation");
    assert.equal(r1.data.manifest_version, 1);
    assert.ok(r1.data.started_at !== null, "running stamps started_at");
    const in1 = r1.data.redacted_input as { url: string; password: string };
    assert.equal(in1.password, "[redacted]", "password must be redacted");
    assert.equal(in1.url, "https://example.com", "non-secret input survives");
    step("recordToolCallEvent tool.started -> running (snapshot + redaction)");

    // 2. tool.completed -> completed (redacted output, completed_at)
    await recordToolCallEvent(db, ctx, completed("tc-1", "browser", { title: "Hello" }));
    const r2 = await getToolCall(db, tcId("tc-1"), customerId);
    assert.ok(r2.ok && r2.data.status === "completed");
    assert.ok(r2.data.completed_at !== null);
    assert.deepEqual(r2.data.redacted_output, { title: "Hello" });
    step("recordToolCallEvent tool.completed -> completed");

    // 3. replay the same terminal event -> idempotent no-op, row unchanged
    await recordToolCallEvent(db, ctx, completed("tc-1", "browser", { title: "Hello" }));
    const r3 = await getToolCall(db, tcId("tc-1"), customerId);
    assert.ok(r3.ok && r3.data.status === "completed", "replay must not corrupt a terminal row");
    step("recordToolCallEvent replay is idempotent (terminal unchanged)");

    // 4. missed tool.started: a terminal event lands while the row is still `proposed`
    await recordToolCallEvent(db, ctx, completed("tc-2", "web", { hits: 3 }));
    const r4 = await getToolCall(db, tcId("tc-2"), customerId);
    assert.ok(r4.ok && r4.data.status === "completed", "missed-started recovers to completed");
    assert.ok(r4.data.started_at !== null, "recovery steps through running (started_at)");
    assert.ok(r4.data.completed_at !== null);
    assert.equal(r4.data.risk, "safe");
    step("recordToolCallEvent missed tool.started -> proposed->running->completed");

    // 5. tool.failed path stamps error code + redacted message
    await recordToolCallEvent(db, ctx, started("tc-3", "terminal"));
    await recordToolCallEvent(db, ctx, failed("tc-3", "terminal", "permission denied"));
    const r5 = await getToolCall(db, tcId("tc-3"), customerId);
    assert.ok(r5.ok && r5.data.status === "failed");
    assert.equal(r5.data.error_code, "tool_error");
    assert.ok((r5.data.error_message_redacted ?? "").includes("permission denied"));
    assert.ok(r5.data.completed_at !== null);
    step("recordToolCallEvent tool.failed -> failed (error stamped)");

    // 6. low-level idempotent create: 23505 conflict -> re-read, no duplicate row
    const input = buildToolCallCreateInput(
      ctx,
      started("tc-4", "file", { path: "/tmp/x" }) as Extract<AioRunEvent, { type: "tool.started" }>,
    );
    const c1 = await createToolCall(db, input);
    const c2 = await createToolCall(db, input);
    assert.ok(c1.ok && c2.ok);
    assert.equal(c1.data.id, c2.data.id, "re-create returns the same row");
    assert.equal(c1.data.status, "proposed");
    const list6 = await listToolCallsForRun(db, runId, customerId);
    assert.ok(list6.ok);
    assert.equal(
      list6.data.filter((r) => r.aio_tool_call_id === tcId("tc-4")).length,
      1,
      "no duplicate tc-4 row",
    );
    step("createToolCall idempotent (re-create re-reads, no duplicate)");

    // 7. terminal immutability: completed -> running is rejected
    const t7 = await transitionStoredToolCall(db, tcId("tc-1"), customerId, "running");
    assert.ok(!t7.ok && t7.code === "ALREADY_TERMINAL");
    step("transitionStoredToolCall completed -> running -> ALREADY_TERMINAL");

    // 8. invalid transition: proposed -> completed must step through running
    const t8 = await transitionStoredToolCall(db, tcId("tc-4"), customerId, "completed");
    assert.ok(!t8.ok && t8.code === "INVALID_TRANSITION");
    step("transitionStoredToolCall proposed -> completed -> INVALID_TRANSITION");

    // 9. cross-tenant isolation
    const g9 = await getToolCall(db, tcId("tc-1"), otherTenant);
    assert.ok(!g9.ok && g9.code === "RUN_NOT_FOUND");
    const t9 = await transitionStoredToolCall(db, tcId("tc-1"), otherTenant, "running");
    assert.ok(!t9.ok && t9.code === "RUN_NOT_FOUND");
    const l9 = await listToolCallsForRun(db, runId, otherTenant);
    assert.ok(l9.ok && l9.data.length === 0);
    step("cross-tenant isolation (get/transition RUN_NOT_FOUND, list empty)");

    // 10. ordered listToolCallsForRun (same tenant, creation order)
    const all = await listToolCallsForRun(db, runId, customerId);
    assert.ok(all.ok);
    assert.deepEqual(
      all.data.map((r) => r.aio_tool_call_id),
      [tcId("tc-1"), tcId("tc-2"), tcId("tc-3"), tcId("tc-4")],
    );
    step("listToolCallsForRun ordered [tc-1..tc-4]");

    console.log("\nALL R2.2 TOOL-CALL PROBE CHECKS PASSED");
  } finally {
    // cascade: dropping the user deletes its run and tool calls.
    const del = await db.auth.admin.deleteUser(customerId);
    if (del.error) console.log(`cleanup warning: ${del.error.message}`);
    else console.log("cleanup: synthetic user + run + tool calls deleted");
  }
}

main().catch((err) => {
  console.error("\nR2.2 PROBE FAILED:", err);
  process.exit(1);
});
