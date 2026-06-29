/**
 * R5.5 at-most-once probe (no Hermes required).
 *
 * Simulates the lease-expiry re-claim duplicate-execution race:
 *   1. A scheduled_task job is enqueued and claimed.
 *   2. Worker A marks the schedule run "running" (markScheduleRunRunning) but
 *      hard-crashes in the window before bindScheduleRunAioRun — so
 *      aio_schedule_runs.aio_run_id stays NULL.
 *   3. The lease expires and worker B re-executes the same job.
 *
 * R5.5 guarantee under test: executeScheduledTaskJob must NOT start a
 * duplicate run. It must mark the run failed (SCHEDULED_RUN_UNBOUND_CRASH),
 * leave aio_run_id NULL, and throw so the job dead-letters (the worker's
 * max_attempts=1 dead-letter path then takes the job to terminal). This probe
 * asserts the throw + the run state; the job dead-letter transition itself is
 * owned by the worker and covered by the R5.3 queue probes.
 *
 * Run against the local Supabase stack:
 *   eval "$(npx -y supabase@2.101.0 status -o env | sed -n \
 *     -e 's/^API_URL=/NEXT_PUBLIC_SUPABASE_URL=/p' \
 *     -e 's/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/p')"
 *   node --import tsx scripts/r5-5-atmostonce-probe.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createServiceClient } from "../src/lib/supabase/service";
import {
  claimNextJob,
  markJobRunning,
} from "../src/lib/aio/jobs/job-repository";
import {
  createSchedule,
  deleteSchedule,
  getScheduleRun,
  markScheduleRunRunning,
} from "../src/lib/aio/schedules/schedule-repository";
import {
  enqueueDueSchedules,
  executeScheduledTaskJob,
} from "../src/lib/aio/schedules/schedule-runtime";

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

const db = createServiceClient();
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const WORKER_ID = "r5-5-atmostonce-probe";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function previewOf(job: { payload_ref?: { preview?: unknown } | null } | null): {
  aioScheduleRunId?: string;
} | null {
  const preview = job?.payload_ref?.preview;
  return preview && typeof preview === "object"
    ? (preview as { aioScheduleRunId?: string })
    : null;
}

async function main() {
  const schedule = await createSchedule(db, {
    customerId: DEV_USER_ID,
    name: `At-most-once probe ${Date.now()}`,
    schedule: new Date(Date.now() - 5_000).toISOString(),
    prompt: "Reply with exactly: at-most-once probe ok",
  });
  if (!schedule.ok) throw new Error(schedule.message);
  let jobId: string | undefined;

  try {
    const sweep = await enqueueDueSchedules({ limit: 10 });
    assert(sweep.enqueued >= 1, `expected >=1 enqueued, got ${sweep.enqueued}`);

    const claimed = await claimNextJob(db, {
      workerId: WORKER_ID,
      leaseSeconds: 120,
      jobTypes: ["scheduled_task"],
    });
    assert(claimed.ok && claimed.data, "expected a scheduled_task job to be claimed");
    jobId = claimed.data!.aio_job_id;

    const running = await markJobRunning(
      db,
      claimed.data!.aio_job_id,
      claimed.data!.lease_token!,
    );
    assert(running.ok, `markJobRunning failed: ${running.ok ? "" : running.message}`);

    const aioScheduleRunId = previewOf(running.data)?.aioScheduleRunId;
    assert(aioScheduleRunId, "job payload preview missing aioScheduleRunId");

    // Worker A marks the run running, then crashes before binding an aio_run.
    const started = await markScheduleRunRunning(db, aioScheduleRunId!, DEV_USER_ID);
    assert(started.ok, `markScheduleRunRunning failed: ${started.ok ? "" : started.message}`);
    const pre = await getScheduleRun(db, aioScheduleRunId!, DEV_USER_ID);
    assert(pre.ok, `getScheduleRun failed: ${pre.ok ? "" : pre.message}`);
    assert(pre.data.status === "running", `expected pre-reclaim run running, got ${pre.data.status}`);
    assert(pre.data.aio_run_id == null, "precondition: run should have no bound aio_run");

    // Worker B re-executes the same job after the lease-expiry re-claim.
    let threw = false;
    let errorMessage = "";
    try {
      await executeScheduledTaskJob(running.data);
    } catch (error) {
      threw = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    assert(threw, "expected executeScheduledTaskJob to throw on an unbound running run");
    assert(
      /cannot be \(re\)started/.test(errorMessage),
      `unexpected guard error: ${errorMessage}`,
    );

    const post = await getScheduleRun(db, aioScheduleRunId!, DEV_USER_ID);
    assert(post.ok, `getScheduleRun(post) failed: ${post.ok ? "" : post.message}`);
    assert(post.data.status === "failed", `expected run failed, got ${post.data.status}`);
    assert(
      post.data.error_code === "SCHEDULED_RUN_UNBOUND_CRASH",
      `expected error_code SCHEDULED_RUN_UNBOUND_CRASH, got ${post.data.error_code}`,
    );
    assert(post.data.aio_run_id == null, "no aio_run should be bound after the guard");

    console.log(
      JSON.stringify(
        {
          threw,
          errorMessage,
          runStatus: post.data.status,
          runErrorCode: post.data.error_code,
          runAioRunId: post.data.aio_run_id,
        },
        null,
        2,
      ),
    );
  } finally {
    if (jobId) {
      await db.from("aio_jobs").delete().eq("aio_job_id", jobId);
    }
    const deleted = await deleteSchedule(db, schedule.data.aio_schedule_id, DEV_USER_ID);
    if (!deleted.ok) {
      console.warn(`[r5-5-atmostonce-probe] cleanup failed: ${deleted.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[r5-5-atmostonce-probe] failed:", error);
  process.exit(1);
});
