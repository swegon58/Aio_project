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
} from "@/lib/aio/jobs/job-repository";
import {
  enqueueDueSchedules,
  executeScheduledTaskJob,
} from "@/lib/aio/schedules/schedule-runtime";

type WorkerDb = Parameters<typeof claimNextJob>[0];

export interface AioJobWorkerLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface AioJobWorkerRuntimeDeps {
  db: WorkerDb;
  pollIntervalMs: number;
  leaseSeconds: number;
  retryLeaseDelaySeconds: number;
  backendUnavailableRetryMs: number;
  workerId: string;
  logger: AioJobWorkerLogger;
  sleep: (ms: number) => Promise<void>;
  setIntervalFn: typeof setInterval;
  clearIntervalFn: typeof clearInterval;
  claimNextJob: typeof claimNextJob;
  completeJob: typeof completeJob;
  failJob: typeof failJob;
  heartbeatJobLease: typeof heartbeatJobLease;
  markJobRunning: typeof markJobRunning;
  nextRetryAt: typeof nextRetryAt;
  releaseDueRetryingJobs: typeof releaseDueRetryingJobs;
  requeueExpiredJobLeases: typeof requeueExpiredJobLeases;
  retryJob: typeof retryJob;
  enqueueDueSchedules: typeof enqueueDueSchedules;
  executeScheduledTaskJob: typeof executeScheduledTaskJob;
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

async function defaultSleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAioJobWorkerRuntime(
  overrides: Partial<AioJobWorkerRuntimeDeps>,
) {
  const deps = overrides as AioJobWorkerRuntimeDeps;

  async function executeJob(job: AioJobRow): Promise<void> {
    switch (job.job_type) {
      case "retention_cleanup":
        return;
      case "knowledge_ingest":
      case "research_stage":
      case "image_generation_poll":
        throw new Error(`No handler wired yet for job type "${job.job_type}"`);
      case "scheduled_task":
        await deps.executeScheduledTaskJob(job);
        return;
      default:
        throw new Error(`Unknown job type "${job.job_type satisfies never}"`);
    }
  }

  async function processClaimedJob(job: AioJobRow): Promise<void> {
    if (!job.lease_token) {
      throw new Error(`Claimed job ${job.aio_job_id} is missing a lease token`);
    }

    const running = await deps.markJobRunning(deps.db, job.aio_job_id, job.lease_token);
    if (!running.ok) {
      throw new Error(`markJobRunning failed: ${running.message}`);
    }

    const heartbeat = deps.setIntervalFn(async () => {
      const result = await deps.heartbeatJobLease(
        deps.db,
        job.aio_job_id,
        job.lease_token as string,
        deps.leaseSeconds,
      );
      if (!result.ok) {
        deps.logger.error(
          `[aio-job-worker] heartbeat lost for ${job.aio_job_id}: ${result.message}`,
        );
      }
    }, Math.max(5000, Math.floor((deps.leaseSeconds * 1000) / 3)));

    try {
      await executeJob(running.data);
      const completed = await deps.completeJob(deps.db, job.aio_job_id, job.lease_token);
      if (!completed.ok) {
        throw new Error(`completeJob failed: ${completed.message}`);
      }
      deps.logger.log(`[aio-job-worker] completed ${job.aio_job_id} (${job.job_type})`);
    } catch (error) {
      const message = errorSummary(error);
      const startedAttempt = running.data.attempt;
      if (startedAttempt < running.data.max_attempts) {
        const retry = await deps.retryJob(deps.db, job.aio_job_id, {
          leaseToken: job.lease_token,
          retryAt: deps.nextRetryAt(startedAttempt),
          errorCode: "JOB_RETRY",
          errorMessageRedacted: message,
        });
        if (!retry.ok) {
          throw new Error(`retryJob failed: ${retry.message}`);
        }
        deps.logger.warn(
          `[aio-job-worker] requeued ${job.aio_job_id} after attempt ${startedAttempt}: ${message}`,
        );
        return;
      }

      const failed = await deps.failJob(deps.db, job.aio_job_id, {
        leaseToken: job.lease_token,
        errorCode: "JOB_FAILED",
        errorMessageRedacted: message,
        deadLetter: true,
      });
      if (!failed.ok) {
        throw new Error(`failJob failed: ${failed.message}`);
      }
      deps.logger.error(
        `[aio-job-worker] dead-lettered ${job.aio_job_id} after attempt ${startedAttempt}: ${message}`,
      );
    } finally {
      deps.clearIntervalFn(heartbeat);
    }
  }

  async function sweepQueues() {
    const schedules = await deps.enqueueDueSchedules({ limit: 25 }).catch((error) => {
      throw new Error(`Failed to enqueue due schedules: ${errorSummary(error)}`);
    });
    if (
      schedules.enqueued > 0 ||
      schedules.skippedOverlap > 0 ||
      schedules.missedWindow > 0
    ) {
      deps.logger.log(
        `[aio-job-worker] schedules enqueued=${schedules.enqueued} skipped_overlap=${schedules.skippedOverlap} missed_window=${schedules.missedWindow}`,
      );
    }

    const released = await deps.releaseDueRetryingJobs(deps.db);
    if (!released.ok) {
      if (isQueueBackendUnavailable(released.message)) {
        throw new Error(released.message);
      }
      deps.logger.error(
        `[aio-job-worker] releaseDueRetryingJobs failed: ${released.message}`,
      );
    } else if (released.data > 0) {
      deps.logger.log(
        `[aio-job-worker] released ${released.data} retrying job(s) back to queue`,
      );
    }

    const requeued = await deps.requeueExpiredJobLeases(
      deps.db,
      deps.retryLeaseDelaySeconds,
    );
    if (!requeued.ok) {
      if (isQueueBackendUnavailable(requeued.message)) {
        throw new Error(requeued.message);
      }
      deps.logger.error(
        `[aio-job-worker] requeueExpiredJobLeases failed: ${requeued.message}`,
      );
    } else if (requeued.data > 0) {
      deps.logger.warn(
        `[aio-job-worker] requeued ${requeued.data} stale leased job(s)`,
      );
    }
  }

  async function loop(shouldStop: () => boolean) {
    let queueBackendUnavailable = false;
    deps.logger.log(
      `[aio-job-worker] started workerId=${deps.workerId} poll=${deps.pollIntervalMs}ms lease=${deps.leaseSeconds}s`,
    );

    while (!shouldStop()) {
      try {
        await sweepQueues();
        if (queueBackendUnavailable) {
          queueBackendUnavailable = false;
          deps.logger.log("[aio-job-worker] queue backend is available again");
        }

        const claimed = await deps.claimNextJob(deps.db, {
          workerId: deps.workerId,
          leaseSeconds: deps.leaseSeconds,
        });
        if (!claimed.ok) {
          throw new Error(claimed.message);
        }
        if (!claimed.data) {
          await deps.sleep(deps.pollIntervalMs);
          continue;
        }

        deps.logger.log(
          `[aio-job-worker] claimed ${claimed.data.aio_job_id} (${claimed.data.job_type})`,
        );
        await processClaimedJob(claimed.data);
      } catch (error) {
        const message = errorSummary(error);
        if (isQueueBackendUnavailable(message)) {
          if (!queueBackendUnavailable) {
            queueBackendUnavailable = true;
            deps.logger.warn(
              `[aio-job-worker] queue backend unavailable in current Supabase project; retrying in ${deps.backendUnavailableRetryMs}ms`,
            );
          }
          await deps.sleep(deps.backendUnavailableRetryMs);
          continue;
        }
        if (!message.includes(JOB_REPO_ERROR_CODE.LEASE_CONFLICT)) {
          deps.logger.error(`[aio-job-worker] loop error: ${message}`);
        }
        await deps.sleep(deps.pollIntervalMs);
      }
    }

    deps.logger.log("[aio-job-worker] stop requested");
  }

  return {
    errorSummary,
    isQueueBackendUnavailable,
    processClaimedJob,
    sweepQueues,
    loop,
  };
}

export const DEFAULT_AIO_JOB_WORKER_RUNTIME_DEPS = {
  claimNextJob,
  completeJob,
  failJob,
  heartbeatJobLease,
  markJobRunning,
  nextRetryAt,
  releaseDueRetryingJobs,
  requeueExpiredJobLeases,
  retryJob,
  enqueueDueSchedules,
  executeScheduledTaskJob,
  sleep: defaultSleep,
  setIntervalFn: setInterval,
  clearIntervalFn: clearInterval,
} satisfies Omit<
  AioJobWorkerRuntimeDeps,
  "db" | "pollIntervalMs" | "leaseSeconds" | "retryLeaseDelaySeconds" | "backendUnavailableRetryMs" | "workerId" | "logger"
>;
