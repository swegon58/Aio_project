import os from "node:os";

import {
  claimNextJob,
  completeJob,
  failJob,
  heartbeatJobLease,
  JOB_REPO_ERROR_CODE,
  markJobRunning,
  nextRetryAt,
  releaseDueRetryingJobs,
  requeueExpiredJobLeases,
  retryJob,
  type AioJobRow,
} from "../src/lib/aio/jobs/job-repository";
import {
  enqueueDueSchedules,
  executeScheduledTaskJob,
} from "../src/lib/aio/schedules/schedule-runtime";
import { serviceDb } from "../src/lib/hermes/registry";

const POLL_INTERVAL_MS = Number(process.env.AIO_JOB_WORKER_POLL_MS ?? 5000);
const LEASE_SECONDS = Number(process.env.AIO_JOB_WORKER_LEASE_SECONDS ?? 60);
const RETRY_LEASE_DELAY_SECONDS = Number(
  process.env.AIO_JOB_WORKER_REQUEUE_DELAY_SECONDS ?? 30,
);
const BACKEND_UNAVAILABLE_RETRY_MS = Math.max(
  POLL_INTERVAL_MS,
  Number(process.env.AIO_JOB_WORKER_BACKEND_RETRY_MS ?? 60_000),
);
const HEARTBEAT_INTERVAL_MS = Math.max(5000, Math.floor((LEASE_SECONDS * 1000) / 3));
const WORKER_ID =
  process.env.AIO_JOB_WORKER_ID ?? `${os.hostname()}:${process.pid}:aio-job-worker`;

const db = serviceDb();
let stopping = false;
let queueBackendUnavailable = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorSummary(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

function isQueueBackendUnavailable(message: string): boolean {
  return (
    message.includes("schema cache") &&
    (message.includes("public.aio_") || message.includes("public.aio_jobs"))
  );
}

async function executeJob(job: AioJobRow): Promise<void> {
  switch (job.job_type) {
    case "retention_cleanup":
      return;
    case "knowledge_ingest":
    case "research_stage":
    case "image_generation_poll":
      throw new Error(`No handler wired yet for job type "${job.job_type}"`);
    case "scheduled_task":
      await executeScheduledTaskJob(job);
      return;
    default:
      throw new Error(`Unknown job type "${job.job_type satisfies never}"`);
  }
}

async function processClaimedJob(job: AioJobRow): Promise<void> {
  if (!job.lease_token) {
    throw new Error(`Claimed job ${job.aio_job_id} is missing a lease token`);
  }

  const running = await markJobRunning(db, job.aio_job_id, job.lease_token);
  if (!running.ok) {
    throw new Error(`markJobRunning failed: ${running.message}`);
  }

  const heartbeat = setInterval(async () => {
    const result = await heartbeatJobLease(
      db,
      job.aio_job_id,
      job.lease_token as string,
      LEASE_SECONDS,
    );
    if (!result.ok) {
      console.error(
        `[aio-job-worker] heartbeat lost for ${job.aio_job_id}: ${result.message}`,
      );
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await executeJob(running.data);
    const completed = await completeJob(db, job.aio_job_id, job.lease_token);
    if (!completed.ok) {
      throw new Error(`completeJob failed: ${completed.message}`);
    }
    console.log(
      `[aio-job-worker] completed ${job.aio_job_id} (${job.job_type})`,
    );
  } catch (error) {
    const message = errorSummary(error);
    const startedAttempt = running.data.attempt;
    if (startedAttempt < running.data.max_attempts) {
      const retry = await retryJob(db, job.aio_job_id, {
        leaseToken: job.lease_token,
        retryAt: nextRetryAt(startedAttempt),
        errorCode: "JOB_RETRY",
        errorMessageRedacted: message,
      });
      if (!retry.ok) {
        throw new Error(`retryJob failed: ${retry.message}`);
      }
      console.warn(
        `[aio-job-worker] requeued ${job.aio_job_id} after attempt ${startedAttempt}: ${message}`,
      );
      return;
    }

    const failed = await failJob(db, job.aio_job_id, {
      leaseToken: job.lease_token,
      errorCode: "JOB_FAILED",
      errorMessageRedacted: message,
      deadLetter: true,
    });
    if (!failed.ok) {
      throw new Error(`failJob failed: ${failed.message}`);
    }
    console.error(
      `[aio-job-worker] dead-lettered ${job.aio_job_id} after attempt ${startedAttempt}: ${message}`,
    );
  } finally {
    clearInterval(heartbeat);
  }
}

async function sweepQueues() {
  const schedules = await enqueueDueSchedules({ limit: 25 }).catch((error) => {
    throw new Error(`Failed to enqueue due schedules: ${errorSummary(error)}`);
  });
  if (schedules.enqueued > 0 || schedules.skippedOverlap > 0 || schedules.missedWindow > 0) {
    console.log(
      `[aio-job-worker] schedules enqueued=${schedules.enqueued} skipped_overlap=${schedules.skippedOverlap} missed_window=${schedules.missedWindow}`,
    );
  }

  const released = await releaseDueRetryingJobs(db);
  if (!released.ok) {
    if (isQueueBackendUnavailable(released.message)) {
      throw new Error(released.message);
    }
    console.error(`[aio-job-worker] releaseDueRetryingJobs failed: ${released.message}`);
  } else if (released.data > 0) {
    console.log(`[aio-job-worker] released ${released.data} retrying job(s) back to queue`);
  }

  const requeued = await requeueExpiredJobLeases(db, RETRY_LEASE_DELAY_SECONDS);
  if (!requeued.ok) {
    if (isQueueBackendUnavailable(requeued.message)) {
      throw new Error(requeued.message);
    }
    console.error(`[aio-job-worker] requeueExpiredJobLeases failed: ${requeued.message}`);
  } else if (requeued.data > 0) {
    console.warn(`[aio-job-worker] requeued ${requeued.data} stale leased job(s)`);
  }
}

async function loop() {
  console.log(
    `[aio-job-worker] started workerId=${WORKER_ID} poll=${POLL_INTERVAL_MS}ms lease=${LEASE_SECONDS}s`,
  );

  while (!stopping) {
    try {
      await sweepQueues();
      if (queueBackendUnavailable) {
        queueBackendUnavailable = false;
        console.log("[aio-job-worker] queue backend is available again");
      }

      const claimed = await claimNextJob(db, {
        workerId: WORKER_ID,
        leaseSeconds: LEASE_SECONDS,
      });
      if (!claimed.ok) {
        throw new Error(claimed.message);
      }
      if (!claimed.data) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      console.log(
        `[aio-job-worker] claimed ${claimed.data.aio_job_id} (${claimed.data.job_type})`,
      );
      await processClaimedJob(claimed.data);
    } catch (error) {
      const message = errorSummary(error);
      if (isQueueBackendUnavailable(message)) {
        if (!queueBackendUnavailable) {
          queueBackendUnavailable = true;
          console.warn(
            `[aio-job-worker] queue backend unavailable in current Supabase project; retrying in ${BACKEND_UNAVAILABLE_RETRY_MS}ms`,
          );
        }
        await sleep(BACKEND_UNAVAILABLE_RETRY_MS);
        continue;
      }
      if (!message.includes(JOB_REPO_ERROR_CODE.LEASE_CONFLICT)) {
        console.error(`[aio-job-worker] loop error: ${message}`);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  console.log("[aio-job-worker] stop requested");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

loop().catch((error) => {
  console.error("[aio-job-worker] fatal:", errorSummary(error));
  process.exit(1);
});
