/**
 * R5.4 enqueue-path probe (no Hermes required).
 *
 * Verifies `enqueueDueSchedules` turns a due Aio-owned schedule into a durable
 * `scheduled_task` job bound to a queued schedule run, advances the schedule,
 * and does not double-fire on a second sweep.
 *
 * The execute half (`executeScheduledTaskJob` -> Hermes orchestrator) needs a
 * provisioned dev-user Hermes registry row and is covered by
 * r5-4-schedule-worker-probe.ts; this probe isolates the new enqueue pipeline.
 *
 * Run against the local Supabase stack:
 *   eval "$(npx -y supabase@2.101.0 status -o env | sed -n \
 *     -e 's/^API_URL=/NEXT_PUBLIC_SUPABASE_URL=/p' \
 *     -e 's/^SERVICE_ROLE_KEY=/SUPABASE_SERVICE_ROLE_KEY=/p')"
 *   node --import tsx scripts/r5-4-schedule-enqueue-probe.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createServiceClient } from "../src/lib/supabase/service";
import {
  listJobsForCustomer,
} from "../src/lib/aio/jobs/job-repository";
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  getScheduleRun,
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

async function scheduledTaskJobsFor(scheduleId: string) {
  const jobs = await listJobsForCustomer(db, DEV_USER_ID);
  if (!jobs.ok) throw new Error(jobs.message);
  return jobs.data.filter(
    (j) => j.job_type === "scheduled_task" && previewOf(j)?.aioScheduleId === scheduleId,
  );
}

async function main() {
  const schedule = await createSchedule(db, {
    customerId: DEV_USER_ID,
    name: `Enqueue probe ${Date.now()}`,
    schedule: new Date(Date.now() - 60_000).toISOString(),
    prompt: "Reply with exactly: enqueue probe ok",
  });
  if (!schedule.ok) throw new Error(schedule.message);
  const scheduleId = schedule.data.aio_schedule_id;
  let jobId: string | undefined;

  try {
    assert(
      (await scheduledTaskJobsFor(scheduleId)).length === 0,
      "no scheduled_task job should exist before enqueue",
    );

    const sweep1 = await enqueueDueSchedules({ limit: 10 });
    assert(sweep1.enqueued >= 1, `expected >=1 enqueued, got ${sweep1.enqueued}`);

    const jobs = await scheduledTaskJobsFor(scheduleId);
    assert(jobs.length === 1, `expected exactly 1 scheduled_task job, got ${jobs.length}`);
    const job = jobs[0]!;
    jobId = job.aio_job_id;
    assert(job.status === "queued", `expected job status queued, got ${job.status}`);

    const preview = previewOf(job);
    assert(preview?.aioScheduleRunId, "job payload preview missing aioScheduleRunId");

    const run = await getScheduleRun(db, preview!.aioScheduleRunId!, DEV_USER_ID);
    if (!run.ok) throw new Error(run.message);
    assert(run.data.status === "queued", `expected schedule run queued, got ${run.data.status}`);
    assert(run.data.aio_job_id === job.aio_job_id, "schedule run not bound to the job");
    assert(run.data.aio_run_id == null, "schedule run should not be bound to an aio_run yet");

    const advanced = await getSchedule(db, scheduleId, DEV_USER_ID);
    if (!advanced.ok) throw new Error(advanced.message);
    assert(advanced.data.last_status === "queued", `expected schedule last_status queued, got ${advanced.data.last_status}`);
    assert(
      advanced.data.next_run_at == null,
      `one-shot schedule should have no next_run_at after occurrence, got ${advanced.data.next_run_at}`,
    );

    const sweep2 = await enqueueDueSchedules({ limit: 10 });
    assert(sweep2.enqueued === 0, `one-shot schedule should not re-fire, got ${sweep2.enqueued}`);
    assert(
      (await scheduledTaskJobsFor(scheduleId)).length === 1,
      "second sweep must not create a duplicate scheduled_task job",
    );

    console.log(
      JSON.stringify(
        {
          scheduleId,
          jobId: job.aio_job_id,
          jobStatus: job.status,
          scheduleRunStatus: run.data.status,
          scheduleRunBoundJobId: run.data.aio_job_id,
          scheduleLastStatus: advanced.data.last_status,
          sweep1Enqueued: sweep1.enqueued,
          sweep2Enqueued: sweep2.enqueued,
        },
        null,
        2,
      ),
    );
  } finally {
    if (jobId) {
      await db.from("aio_jobs").delete().eq("aio_job_id", jobId);
    }
    const deleted = await deleteSchedule(db, scheduleId, DEV_USER_ID);
    if (!deleted.ok) {
      console.warn(`[r5-4-schedule-enqueue-probe] cleanup failed: ${deleted.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[r5-4-schedule-enqueue-probe] failed:", error);
  process.exit(1);
});
