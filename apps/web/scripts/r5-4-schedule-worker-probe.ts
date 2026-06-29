import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createServiceClient } from "../src/lib/supabase/service";
import {
  claimNextJob,
  completeJob,
  markJobRunning,
} from "../src/lib/aio/jobs/job-repository";
import { getRun } from "../src/lib/aio/runs/run-repository";
import {
  createSchedule,
  deleteSchedule,
  getScheduleRun,
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
const WORKER_ID = "r5-4-schedule-probe";

async function main() {
  const schedule = await createSchedule(db, {
    customerId: DEV_USER_ID,
    name: `Probe ${Date.now()}`,
    schedule: new Date(Date.now() - 5_000).toISOString(),
    prompt: "Reply with exactly: schedule probe ok",
  });
  if (!schedule.ok) throw new Error(schedule.message);
  let jobId: string | undefined;

  try {
    const sweep = await enqueueDueSchedules({ limit: 10 });
    if (sweep.enqueued < 1) {
      throw new Error("Expected at least one due schedule to enqueue");
    }

    const claimed = await claimNextJob(db, {
      workerId: WORKER_ID,
      leaseSeconds: 120,
      jobTypes: ["scheduled_task"],
    });
    if (!claimed.ok || !claimed.data) {
      throw new Error(claimed.ok ? "Expected a scheduled_task job to be claimed" : claimed.message);
    }
    jobId = claimed.data.aio_job_id;

    const running = await markJobRunning(
      db,
      claimed.data.aio_job_id,
      claimed.data.lease_token!,
    );
    if (!running.ok) throw new Error(running.message);

    await executeScheduledTaskJob(running.data);

    const completed = await completeJob(
      db,
      running.data.aio_job_id,
      running.data.lease_token!,
    );
    if (!completed.ok) throw new Error(completed.message);

    const preview = running.data.payload_ref?.preview as
      | { aioScheduleRunId?: string }
      | undefined;
    const aioScheduleRunId = preview?.aioScheduleRunId;
    if (!aioScheduleRunId) {
      throw new Error("Expected scheduled_task payload preview to include aioScheduleRunId");
    }

    const scheduleRun = await getScheduleRun(db, aioScheduleRunId, DEV_USER_ID);
    if (!scheduleRun.ok) throw new Error(scheduleRun.message);
    if (!scheduleRun.data.aio_run_id) {
      throw new Error("Expected schedule run to be bound to an aio_run");
    }

    const run = await getRun(db, scheduleRun.data.aio_run_id, DEV_USER_ID);
    if (!run.ok) throw new Error(run.message);

    console.log(
      JSON.stringify(
        {
          enqueued: sweep.enqueued,
          jobStatus: completed.data.status,
          scheduleRunStatus: scheduleRun.data.status,
          aioRunStatus: run.data.status,
          durableRunId: run.data.id,
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
      console.warn(`[r5-4-schedule-worker-probe] cleanup failed: ${deleted.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[r5-4-schedule-worker-probe] failed:", error);
  process.exit(1);
});
