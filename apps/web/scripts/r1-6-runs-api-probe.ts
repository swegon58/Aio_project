// R1.6 live API probe. Hits the local Next dev server over HTTP and verifies
// the authenticated run APIs end to end under the dev-bypass tenant:
// list, detail, ordered events replay, invalid query handling, and the durable
// stop route's terminal / not-started / Hermes-404 branches.
//
// Usage:
//   cd apps/web && npx tsx scripts/r1-6-runs-api-probe.ts
//
// Assumes:
//   - NEXT_PUBLIC_DEV_AUTH_BYPASS=true in .env.local
//   - local Next server is running (default http://127.0.0.1:3000)
//   - local Hermes gateway is running for the Hermes-forwarded stop probe

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createServiceClient } from "../src/lib/supabase/service";
import {
  attachHermesIdentity,
  createRun,
  markTerminal,
  transitionRun,
} from "../src/lib/aio/runs/run-repository";
import { appendEvent } from "../src/lib/aio/runs/run-event-repository";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const BASE_URL = process.env.AIO_BASE_URL ?? "http://127.0.0.1:3000";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env or .env.local");
  process.exit(2);
}

if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS !== "true") {
  console.error("R1.6 probe expects NEXT_PUBLIC_DEV_AUTH_BYPASS=true so /api/runs uses the fixed dev tenant.");
  process.exit(2);
}

const db = createServiceClient();
const createdRunIds: string[] = [];
const createdConversationIds: string[] = [];
const marker = `r1.6-probe-${Date.now()}`;
const step = (name: string) => console.log(`  ✓ ${name}`);
const newThreadId = () => crypto.randomUUID();

async function ensureDevUser() {
  const existing = await db.auth.admin.getUserById(DEV_USER_ID);
  if (existing.data.user) {
    step("dev bypass user exists");
    return;
  }

  const created = await db.auth.admin.createUser({
    id: DEV_USER_ID,
    email: "dev-bypass@aio.local",
    email_confirm: true,
    user_metadata: { dev_bypass: true },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Failed to seed dev user: ${created.error?.message ?? "unknown error"}`);
  }
  step("seeded dev bypass user");
}

async function getJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

async function postJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST" });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

async function createConversation(title: string): Promise<string> {
  const id = newThreadId();
  const inserted = await db.from("hermes_conversations").insert({
    id,
    customer_id: DEV_USER_ID,
    title,
    messages: [],
  });
  if (inserted.error) {
    throw new Error(`Failed to seed conversation "${title}": ${inserted.error.message}`);
  }
  createdConversationIds.push(id);
  return id;
}

async function main() {
  await ensureDevUser();

  try {
    const listConversationId = await createConversation(`${marker} list/detail/events`);
    const listRun = await createRun(db, {
      customerId: DEV_USER_ID,
      threadId: listConversationId,
      conversationId: listConversationId,
      mode: "deep_research",
      inputSummary: `${marker} list/detail/events`,
      reservedCredits: 2,
      metadata: { kind: "r1.6-probe", marker, target: "list-detail-events" },
    });
    if (!listRun.ok) throw new Error(`createRun(listRun) failed: ${listRun.message}`);
    createdRunIds.push(listRun.data.id);

    const started = await transitionRun(db, listRun.data.id, DEV_USER_ID, "running");
    assert.ok(started.ok, "listRun should transition to running");

    const evt0 = await appendEvent(db, {
      id: crypto.randomUUID(),
      runId: listRun.data.id,
      customerId: DEV_USER_ID,
      source: "aio",
      occurredAt: "2026-06-28T10:00:00.000Z",
      receivedAt: "2026-06-28T10:00:01.000Z",
      payload: {
        type: "run.created",
        runId: listRun.data.id,
        threadId: listRun.data.thread_id,
        status: "running",
        createdAt: "2026-06-28T10:00:00.000Z",
        ts: Date.parse("2026-06-28T10:00:00.000Z"),
      },
    });
    assert.ok(evt0.ok && evt0.data.sequence === 0);

    const evt1 = await appendEvent(db, {
      id: crypto.randomUUID(),
      runId: listRun.data.id,
      customerId: DEV_USER_ID,
      source: "hermes",
      occurredAt: "2026-06-28T10:00:02.000Z",
      receivedAt: "2026-06-28T10:00:03.000Z",
      hermes: { runId: "hermes-probe-run", eventId: "evt-source-1" },
      payload: {
        type: "message.delta",
        runId: listRun.data.id,
        createdAt: "2026-06-28T10:00:02.000Z",
        ts: Date.parse("2026-06-28T10:00:02.000Z"),
        delta: "hello from probe",
      },
    });
    assert.ok(evt1.ok && evt1.data.sequence === 1);
    step("seeded probe run + ordered events");

    const stopQueuedConversationId = await createConversation(`${marker} stop not started`);
    const stopNotStarted = await createRun(db, {
      customerId: DEV_USER_ID,
      threadId: stopQueuedConversationId,
      conversationId: stopQueuedConversationId,
      mode: "chat",
      inputSummary: `${marker} stop not started`,
      metadata: { kind: "r1.6-probe", marker, target: "stop-not-started" },
    });
    if (!stopNotStarted.ok) throw new Error(`createRun(stopNotStarted) failed: ${stopNotStarted.message}`);
    createdRunIds.push(stopNotStarted.data.id);

    const stopHermesConversationId = await createConversation(`${marker} stop hermes 404`);
    const stopHermes404 = await createRun(db, {
      customerId: DEV_USER_ID,
      threadId: stopHermesConversationId,
      conversationId: stopHermesConversationId,
      mode: "chat",
      inputSummary: `${marker} stop hermes 404`,
      metadata: { kind: "r1.6-probe", marker, target: "stop-hermes-404" },
    });
    if (!stopHermes404.ok) throw new Error(`createRun(stopHermes404) failed: ${stopHermes404.message}`);
    createdRunIds.push(stopHermes404.data.id);
    const stopHermesAttached = await attachHermesIdentity(
      db,
      stopHermes404.data.id,
      DEV_USER_ID,
      `missing-hermes-run-${marker}`,
      "dev-session",
    );
    assert.ok(stopHermesAttached.ok);
    const stopHermesRunning = await transitionRun(db, stopHermes404.data.id, DEV_USER_ID, "running");
    assert.ok(stopHermesRunning.ok);

    const stopTerminalConversationId = await createConversation(`${marker} stop terminal`);
    const stopTerminal = await createRun(db, {
      customerId: DEV_USER_ID,
      threadId: stopTerminalConversationId,
      conversationId: stopTerminalConversationId,
      mode: "image",
      inputSummary: `${marker} stop terminal`,
      metadata: { kind: "r1.6-probe", marker, target: "stop-terminal" },
    });
    if (!stopTerminal.ok) throw new Error(`createRun(stopTerminal) failed: ${stopTerminal.message}`);
    createdRunIds.push(stopTerminal.data.id);
    const stopTerminalRunning = await transitionRun(db, stopTerminal.data.id, DEV_USER_ID, "running");
    assert.ok(stopTerminalRunning.ok);
    const stopTerminalDone = await markTerminal(db, stopTerminal.data.id, DEV_USER_ID, "completed");
    assert.ok(stopTerminalDone.ok);
    step("seeded stop-route coverage runs");

    const list = await getJson("/api/runs?limit=10");
    assert.equal(list.res.status, 200, "GET /api/runs should return 200");
    assert.ok(Array.isArray((list.json as { runs?: unknown[] }).runs));
    const runs = (list.json as { runs: Array<{ id: string }> }).runs;
    const topIds = runs.slice(0, 4).map((run) => run.id);
    assert.ok(topIds.includes(stopTerminal.data.id), "newest runs should appear in the first page");
    assert.ok(topIds.includes(stopHermes404.data.id), "newest runs should appear in the first page");
    assert.ok(topIds.includes(stopNotStarted.data.id), "newest runs should appear in the first page");
    assert.ok(topIds.includes(listRun.data.id), "newest runs should appear in the first page");
    step("GET /api/runs lists newest probe runs");

    const badLimit = await getJson("/api/runs?limit=0");
    assert.equal(badLimit.res.status, 400);
    assert.equal((badLimit.json as { error?: string }).error, "invalid_limit");
    step("GET /api/runs rejects invalid limit");

    const badCursor = await getJson("/api/runs?cursor=!!!");
    assert.equal(badCursor.res.status, 400);
    assert.equal((badCursor.json as { code?: string }).code, "BAD_CURSOR");
    step("GET /api/runs rejects bad cursor");

    const detail = await getJson(`/api/runs/${listRun.data.id}`);
    assert.equal(detail.res.status, 200);
    const detailRun = (detail.json as { run: { id: string; status: string; mode: string } }).run;
    assert.equal(detailRun.id, listRun.data.id);
    assert.equal(detailRun.status, "running");
    assert.equal(detailRun.mode, "deep_research");
    step("GET /api/runs/[runId] returns the run shell");

    const missing = await getJson(`/api/runs/${crypto.randomUUID()}`);
    assert.equal(missing.res.status, 404);
    assert.equal((missing.json as { code?: string }).code, "RUN_NOT_FOUND");
    step("GET /api/runs/[runId] hides missing runs behind RUN_NOT_FOUND");

    const events = await getJson(`/api/runs/${listRun.data.id}/events`);
    assert.equal(events.res.status, 200);
    const eventRows = (events.json as { events: Array<{ sequence: number; source: string }> }).events;
    assert.deepEqual(
      eventRows.map((event) => event.sequence),
      [0, 1],
    );
    assert.deepEqual(
      eventRows.map((event) => event.source),
      ["aio", "hermes"],
    );
    step("GET /api/runs/[runId]/events replays the full ordered timeline");

    const after0 = await getJson(`/api/runs/${listRun.data.id}/events?afterSequence=0`);
    assert.equal(after0.res.status, 200);
    assert.deepEqual(
      (after0.json as { events: Array<{ sequence: number }> }).events.map((event) => event.sequence),
      [1],
    );
    step("GET /api/runs/[runId]/events respects afterSequence");

    const badAfterSequence = await getJson(`/api/runs/${listRun.data.id}/events?afterSequence=-2`);
    assert.equal(badAfterSequence.res.status, 400);
    assert.equal(
      (badAfterSequence.json as { error?: string }).error,
      "invalid_after_sequence",
    );
    step("GET /api/runs/[runId]/events rejects invalid afterSequence");

    const stoppedQueued = await postJson(`/api/runs/${stopNotStarted.data.id}/stop`);
    assert.equal(stoppedQueued.res.status, 200);
    assert.equal((stoppedQueued.json as { ok?: boolean }).ok, true);
    assert.equal((stoppedQueued.json as { hermesStatus?: string }).hermesStatus, "not_started");
    assert.equal((stoppedQueued.json as { run: { status: string } }).run.status, "cancelling");
    step("POST /api/runs/[runId]/stop handles queued runs before Hermes starts");

    const stoppedHermes404 = await postJson(`/api/runs/${stopHermes404.data.id}/stop`);
    assert.equal(stoppedHermes404.res.status, 200);
    assert.equal((stoppedHermes404.json as { ok?: boolean }).ok, true);
    assert.equal((stoppedHermes404.json as { hermesStatus?: string }).hermesStatus, "run_not_found");
    assert.equal(
      (stoppedHermes404.json as { hermesForwarded?: boolean }).hermesForwarded,
      false,
    );
    step("POST /api/runs/[runId]/stop tolerates missing Hermes runs");

    const stoppedTerminal = await postJson(`/api/runs/${stopTerminal.data.id}/stop`);
    assert.equal(stoppedTerminal.res.status, 200);
    assert.equal((stoppedTerminal.json as { noop?: boolean }).noop, true);
    assert.equal(
      (stoppedTerminal.json as { hermesStatus?: string }).hermesStatus,
      "already_terminal",
    );
    assert.equal((stoppedTerminal.json as { run: { status: string } }).run.status, "completed");
    step("POST /api/runs/[runId]/stop is idempotent for terminal runs");

    console.log("\nALL R1.6 RUN API PROBE CHECKS PASSED");
  } finally {
    if (createdRunIds.length > 0) {
      const cleanup = await db.from("aio_runs").delete().in("id", createdRunIds);
      if (cleanup.error) {
        console.log(`cleanup warning: ${cleanup.error.message}`);
      } else {
        console.log(`cleanup: deleted ${createdRunIds.length} probe run(s)`);
      }
    }
    if (createdConversationIds.length > 0) {
      const cleanup = await db
        .from("hermes_conversations")
        .delete()
        .in("id", createdConversationIds);
      if (cleanup.error) {
        console.log(`cleanup warning: ${cleanup.error.message}`);
      } else {
        console.log(`cleanup: deleted ${createdConversationIds.length} probe conversation(s)`);
      }
    }
  }
}

main().catch((error) => {
  console.error("\nR1.6 PROBE FAILED:", error);
  process.exit(1);
});
