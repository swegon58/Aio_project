// R2.3 live approval probe (not part of the build; run with tsx against the
// local Supabase stack). Exercises the DB-backed approval recording path that
// the run orchestrator now calls on every `approval.*` event: both the
// high-level `recordApprovalEvent` entry (request + respond, including the
// edited path) and the low-level repository contracts (idempotent request,
// resolve-once replay, expiry enforcement + lazy sweep, terminal immutability,
// cross-tenant isolation, ordered list). Cleans up by deleting the synthetic
// user, which cascades to its run and approvals.
//
// Target: the LOCAL docker Supabase stack (kong on :54321), where migration
// 0013_aio_approvals.sql is applied. The main worktree's .env.local points at
// a stale cloud project that was never migrated, so run this from a worktree
// without .env.local with the local stack env exported:
//
//   cd apps/web
//   export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
//   export SUPABASE_SERVICE_ROLE_KEY=<local service_role JWT>
//   npx tsx scripts/r2-3-approval-probe.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createServiceClient } from "../src/lib/supabase/service";
import { createRun } from "../src/lib/aio/runs/run-repository";
import type { AioRunEvent } from "../src/lib/aio/runs/aio-run-events";
import { recordApprovalEvent } from "../src/lib/aio/tools/approval-writer";
import {
  getApproval,
  listApprovalsForRun,
  requestApproval,
  resolveApproval,
  sweepExpiredApprovals,
} from "../src/lib/aio/tools/approval-repository";

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
const iso = () => new Date().toISOString();

async function main() {
  // ---- synthetic tenant + a real run row the FK accepts ----
  const email = `r2-3-probe-${Date.now()}@example.com`;
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
    threadId: "thread-r2-3",
    mode: "chat",
    inputSummary: "r2-3 probe",
  });
  if (!run.ok) throw new Error(`createRun failed: ${run.message}`);
  const runId = run.data.id;
  const ctx = { runId, customerId };
  const requested = (approvalId: string, extra: Partial<Extract<AioRunEvent, { type: "approval.requested" }>> = {}): AioRunEvent =>
    ({ type: "approval.requested", runId, approvalId, createdAt: iso(), ...extra }) as AioRunEvent;
  const responded = (approvalId: string, status: "approved" | "rejected" | "edited"): AioRunEvent =>
    ({ type: "approval.responded", runId, approvalId, status, createdAt: iso() }) as AioRunEvent;

  try {
    // 1. recordApprovalEvent approval.requested -> requested (snapshot + redaction + TTL)
    await recordApprovalEvent(db, ctx, requested("ap-1", {
      toolCallId: `${runId}:tc-1`,
      title: "Run shell command",
      payload: { cwd: "/tmp", token: "sk-live-abc" },
      riskLevel: "dangerous",
    }));
    const r1 = await getApproval(db, "ap-1", customerId);
    assert.ok(r1.ok, "ap-1 should exist");
    assert.equal(r1.data.status, "requested");
    assert.equal(r1.data.risk, "dangerous");
    assert.equal(r1.data.approval_mode, "once");
    assert.equal(r1.data.aio_tool_call_id, `${runId}:tc-1`);
    assert.equal(r1.data.title, "Run shell command");
    assert.ok(Date.parse(r1.data.expires_at) > Date.now(), "expires_at is in the future");
    const in1 = r1.data.requested_input_redacted as { cwd: string; token: string };
    assert.equal(in1.token, "[redacted]", "token must be redacted");
    assert.equal(in1.cwd, "/tmp", "non-secret input survives");
    step("recordApprovalEvent approval.requested -> requested (snapshot + redaction + TTL)");

    // 2. recordApprovalEvent approval.responded (approved) -> approved
    await recordApprovalEvent(db, ctx, responded("ap-1", "approved"));
    const r2 = await getApproval(db, "ap-1", customerId);
    assert.ok(r2.ok && r2.data.status === "approved");
    assert.equal(r2.data.resolution, "approve");
    assert.equal(r2.data.resolved_by, customerId);
    assert.ok(r2.data.resolved_at !== null);
    step("recordApprovalEvent approval.responded (approved) -> approved");

    // 3. resolve-once replay: re-resolving approved is a safe no-op
    const replayRepo = await resolveApproval(db, "ap-1", customerId, { resolution: "approve", resolvedBy: customerId });
    assert.ok(replayRepo.ok && replayRepo.data.status === "approved", "re-resolve is a no-op");
    await recordApprovalEvent(db, ctx, responded("ap-1", "approved")); // writer replay
    const r3 = await getApproval(db, "ap-1", customerId);
    assert.ok(r3.ok && r3.data.status === "approved" && r3.data.resolution === "approve", "writer replay must not corrupt a terminal row");
    step("resolve-once replay is idempotent (repo + writer)");

    // 4. API-style reject on a fresh approval
    await recordApprovalEvent(db, ctx, requested("ap-2", { riskLevel: "dangerous", title: "delete files" }));
    const rej = await resolveApproval(db, "ap-2", customerId, { resolution: "reject", resolvedBy: customerId });
    assert.ok(rej.ok && rej.data.status === "rejected" && rej.data.resolution === "reject");
    step("resolveApproval reject -> rejected");

    // 5. edited path: approval.responded status "edited" -> approved with resolution edit
    await recordApprovalEvent(db, ctx, requested("ap-3", { riskLevel: "medium", title: "edit then run" }));
    await recordApprovalEvent(db, ctx, responded("ap-3", "edited"));
    const r5 = await getApproval(db, "ap-3", customerId);
    assert.ok(r5.ok && r5.data.status === "approved", "edited proceeds as approved");
    assert.equal(r5.data.resolution, "edit");
    step("recordApprovalEvent approval.responded (edited) -> approved (resolution edit)");

    // 6. terminal immutability: resolving an approved row to reject -> ALREADY_TERMINAL
    const t6 = await resolveApproval(db, "ap-1", customerId, { resolution: "reject", resolvedBy: customerId });
    assert.ok(!t6.ok && t6.code === "ALREADY_TERMINAL");
    step("resolveApproval approved -> reject -> ALREADY_TERMINAL");

    // 7. expiry: a requested row past expires_at is lazily expired and cannot be resolved
    const exp = await requestApproval(db, {
      aioApprovalId: "ap-4",
      runId,
      customerId,
      risk: "guarded",
      approvalMode: "once",
      title: "expiring",
      requestedInput: { note: "past ttl" },
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      idempotencyKey: `request:${runId}:ap-4`,
    });
    assert.ok(exp.ok);
    const r7get = await getApproval(db, "ap-4", customerId);
    assert.ok(r7get.ok && r7get.data.status === "expired", "getApproval lazy-expires overdue rows");
    const r7res = await resolveApproval(db, "ap-4", customerId, { resolution: "approve", resolvedBy: customerId });
    assert.ok(!r7res.ok && r7res.code === "ALREADY_TERMINAL", "resolving an expired approval is rejected");
    step("expiry enforced (lazy expire on get + resolve -> ALREADY_TERMINAL)");

    // 8. low-level idempotent request: 23505 conflict -> re-read, no duplicate row
    const input8 = {
      aioApprovalId: "ap-5",
      runId,
      customerId,
      risk: "safe" as const,
      approvalMode: "once" as const,
      title: "idempotent",
      requestedInput: { a: 1 },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      idempotencyKey: `request:${runId}:ap-5`,
    };
    const c1 = await requestApproval(db, input8);
    const c2 = await requestApproval(db, input8);
    assert.ok(c1.ok && c2.ok);
    assert.equal(c1.data.id, c2.data.id, "re-request returns the same row");
    step("requestApproval idempotent (re-request re-reads, no duplicate)");

    // 9. sweepExpiredApprovals moves overdue requested rows and reports the count.
    // ap-4 was already lazily expired by the get in step 7, so create a fresh
    // overdue row (ap-6) that only the bulk sweep touches.
    const input6 = {
      aioApprovalId: "ap-6",
      runId,
      customerId,
      risk: "guarded" as const,
      approvalMode: "once" as const,
      title: "sweep me",
      requestedInput: { n: 6 },
      expiresAt: new Date(Date.now() - 30_000).toISOString(),
      idempotencyKey: `request:${runId}:ap-6`,
    };
    const c6 = await requestApproval(db, input6);
    assert.ok(c6.ok && c6.data.status === "requested");
    const swept = await sweepExpiredApprovals(db, { runId, customerId });
    assert.ok(swept >= 1, "sweep moves at least the overdue ap-6");
    const r9 = await getApproval(db, "ap-6", customerId);
    assert.ok(r9.ok && r9.data.status === "expired");
    step(`sweepExpiredApprovals moved ${swept} overdue row(s)`);

    // 10. cross-tenant isolation
    const g10 = await getApproval(db, "ap-1", otherTenant);
    assert.ok(!g10.ok && g10.code === "RUN_NOT_FOUND");
    const t10 = await resolveApproval(db, "ap-2", otherTenant, { resolution: "approve" });
    assert.ok(!t10.ok && t10.code === "RUN_NOT_FOUND");
    const l10 = await listApprovalsForRun(db, runId, otherTenant);
    assert.ok(l10.ok && l10.data.length === 0);
    step("cross-tenant isolation (get/resolve RUN_NOT_FOUND, list empty)");

    // 11. ordered listApprovalsForRun (same tenant, creation order)
    const all = await listApprovalsForRun(db, runId, customerId);
    assert.ok(all.ok);
    assert.deepEqual(
      all.data.map((r) => r.aio_approval_id),
      ["ap-1", "ap-2", "ap-3", "ap-4", "ap-5", "ap-6"],
    );
    step("listApprovalsForRun ordered [ap-1..ap-6]");

    console.log("\nALL R2.3 APPROVAL PROBE CHECKS PASSED");
  } finally {
    // cascade: dropping the user deletes its run and approvals.
    const del = await db.auth.admin.deleteUser(customerId);
    if (del.error) console.log(`cleanup warning: ${del.error.message}`);
    else console.log("cleanup: synthetic user + run + approvals deleted");
  }
}

main().catch((err) => {
  console.error("\nR2.3 PROBE FAILED:", err);
  process.exit(1);
});
