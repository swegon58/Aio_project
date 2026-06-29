/**
 * R5.5 cancel-propagation probe (no Hermes required).
 *
 * Verifies the R5.5 cancel-propagation wiring:
 *   - `deleteSchedule` cancels queued scheduled_task jobs for that schedule.
 *   - `pauseSchedule` cancels queued scheduled_task jobs for that schedule.
 *   - `cancelQueuedJobsForSchedule` is scoped to one schedule and does not
 *     touch another schedule's queued job, and only cancels queued jobs.
 *
 * Together these guarantee the worker cannot start an occurrence for a
 * schedule the user has removed or paused.
 *
 * Run against the local Supabase stack:
 *   eval "$(npx -y supabase@2.101.0 status -o env | sed -n \
 *     -e 's/^API_URL=/NEXT_PUBLIC_SUPABASE_URL=/p' \
 *     -e 's/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/p')"
 *   node --import tsx scripts/r5-5-cancel-propagation-probe.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createServiceClient } from "../src/lib/supabase/service";
import {
  cancelQueuedJobsForSchedule,
  listJobsForCustomer,
} from "../src/lib/aio/jobs/job-repository";
import {
  createSchedule,
  deleteSchedule,
  pauseSchedule,
} from "../src/lib/aio/schedules/schedule-repository";
import { enqueueDueSchedules } from "../src/lib/aio/schedules/schedule-runtime";

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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function previewOf(job: { payload_ref?: { preview?: unknown } | null } | null): {
  aioScheduleId?: string;
  aioScheduleRunId?: string;
} | null {
  const preview = job?.payload_ref?.preview;
  return preview && typeof preview === "object"
    ? (preview as { aioScheduleId?: string; aioScheduleRunId?: string })
    : null;
}

async function queuedScheduledTaskJobs(scheduleId: string) {
  const jobs = await listJobsForCustomer(db, DEV_USER_ID, ["queued"]);
  if (!jobs.ok) throw new Error(jobs.message);
  return jobs.data.filter(
    (j) => j.job_type === "scheduled_task" && previewOf(j)?.aioScheduleId === scheduleId,
  );
}

async function jobStatus(jobId: string): Promise<string> {
  const jobs = await listJobsForCustomer(db, DEV_USER_ID);
  if (!jobs.ok) throw new Error(jobs.message);
  const job = jobs.data.find((j) => j.aio_job_id === jobId);
  if (!job) throw new Error(`job ${jobId} not found while reading status`);
  return job.status;
}

async function makeDueSchedule(label: string) {
  const schedule = await createSchedule(db, {
    customerId: DEV_USER_ID,
    name: `${label} ${Date.now()}`,
    schedule: new Date(Date.now() - 60_000).toISOString(),
    prompt: "Reply with exactly: cancel probe ok",
  });
  if (!schedule.ok) throw new Error(schedule.message);
  const sweep = await enqueueDueSchedules({ limit: 25 });
  assert(sweep.enqueued >= 1, `expected >=1 enqueued for ${label}, got ${sweep.enqueued}`);
  const jobs = await queuedScheduledTaskJobs(schedule.data.aio_schedule_id);
  assert(jobs.length === 1, `expected 1 queued job for ${label}, got ${jobs.length}`);
  assert(jobs[0]!.status === "queued", `expected queued, got ${jobs[0]!.status}`);
  return { scheduleId: schedule.data.aio_schedule_id, jobId: jobs[0]!.aio_job_id };
}

async function cleanup(scheduleIds: string[], jobIds: string[]) {
  for (const jobId of jobIds) {
    await db.from("aio_jobs").delete().eq("aio_job_id", jobId);
  }
  for (const scheduleId of scheduleIds) {
    const deleted = await deleteSchedule(db, scheduleId, DEV_USER_ID);
    if (!deleted.ok) {
      console.warn(`[r5-5-cancel-propagation-probe] cleanup failed for ${scheduleId}: ${deleted.message}`);
    }
  }
}

async function main() {
  const scheduleIds: string[] = [];
  const jobIds: string[] = [];

  try {
    // Case A: deleting a schedule cancels its queued job.
    const a = await makeDueSchedule("delete-case");
    scheduleIds.push(a.scheduleId);
    jobIds.push(a.jobId);
    const deleted = await deleteSchedule(db, a.scheduleId, DEV_USER_ID);
    assert(deleted.ok, `deleteSchedule failed: ${deleted.ok ? "" : deleted.message}`);
    assert(
      (await jobStatus(a.jobId)) === "cancelled",
      `delete should cancel queued job, got ${await jobStatus(a.jobId)}`,
    );

    // Case B: pausing a schedule cancels its queued job.
    const b = await makeDueSchedule("pause-case");
    scheduleIds.push(b.scheduleId);
    jobIds.push(b.jobId);
    const paused = await pauseSchedule(db, b.scheduleId, DEV_USER_ID, "r5-5 probe");
    assert(paused.ok, `pauseSchedule failed: ${paused.ok ? "" : paused.message}`);
    assert(paused.data.state === "paused", `expected schedule paused, got ${paused.data.state}`);
    assert(
      (await jobStatus(b.jobId)) === "cancelled",
      `pause should cancel queued job, got ${await jobStatus(b.jobId)}`,
    );

    // Case C: the helper is scoped to one schedule and only touches queued jobs.
    const c1 = await makeDueSchedule("scope-keep");
    const c2 = await makeDueSchedule("scope-cancel");
    scheduleIds.push(c1.scheduleId, c2.scheduleId);
    jobIds.push(c1.jobId, c2.jobId);
    const cancelledCount = await cancelQueuedJobsForSchedule(db, DEV_USER_ID, c2.scheduleId);
    assert(cancelledCount.ok, `cancelQueuedJobsForSchedule failed: ${!cancelledCount.ok ? cancelledCount.code : ""}`);
    assert(cancelledCount.data === 1, `expected helper to cancel 1 job, got ${cancelledCount.data}`);
    assert(
      (await jobStatus(c1.jobId)) === "queued",
      `helper must not cancel another schedule's job, got ${await jobStatus(c1.jobId)}`,
    );
    assert(
      (await jobStatus(c2.jobId)) === "cancelled",
      `helper should cancel the target job, got ${await jobStatus(c2.jobId)}`,
    );

    console.log(
      JSON.stringify(
        {
          deleteCaseJobStatus: await jobStatus(a.jobId),
          pauseCaseJobStatus: await jobStatus(b.jobId),
          pauseCaseScheduleState: paused.data.state,
          scopeKeepJobStatus: await jobStatus(c1.jobId),
          scopeCancelJobStatus: await jobStatus(c2.jobId),
          scopeCancelCount: cancelledCount.data,
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup(scheduleIds, jobIds);
  }
}

main().catch((error) => {
  console.error("[r5-5-cancel-propagation-probe] failed:", error);
  process.exit(1);
});
