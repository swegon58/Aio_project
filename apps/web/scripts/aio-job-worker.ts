import os from "node:os";

import {
  claimNextJob,
  releaseDueRetryingJobs,
  requeueExpiredJobLeases,
} from "../src/lib/aio/jobs/job-repository";
import {
  createAioJobWorkerRuntime,
  DEFAULT_AIO_JOB_WORKER_RUNTIME_DEPS,
} from "../src/lib/aio/jobs/aio-job-worker-runtime";
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
const WORKER_ID =
  process.env.AIO_JOB_WORKER_ID ?? `${os.hostname()}:${process.pid}:aio-job-worker`;

const db = serviceDb();
let stopping = false;
const runtime = createAioJobWorkerRuntime({
  ...DEFAULT_AIO_JOB_WORKER_RUNTIME_DEPS,
  db,
  pollIntervalMs: POLL_INTERVAL_MS,
  leaseSeconds: LEASE_SECONDS,
  retryLeaseDelaySeconds: RETRY_LEASE_DELAY_SECONDS,
  backendUnavailableRetryMs: BACKEND_UNAVAILABLE_RETRY_MS,
  workerId: WORKER_ID,
  logger: console,
  claimNextJob,
  releaseDueRetryingJobs,
  requeueExpiredJobLeases,
  enqueueDueSchedules,
  executeScheduledTaskJob,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

runtime.loop(() => stopping).catch((error) => {
  console.error("[aio-job-worker] fatal:", runtime.errorSummary(error));
  process.exit(1);
});
