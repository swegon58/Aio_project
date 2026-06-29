import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createServiceClient } from "../src/lib/supabase/service";
import {
  claimNextJob,
  completeJob,
  createJob,
  getJob,
  markJobRunning,
  releaseDueRetryingJobs,
  requeueExpiredJobLeases,
  retryJob,
} from "../src/lib/aio/jobs/job-repository";

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
const WORKER_ID = "r5-3-probe";

async function main() {
  const email = `r5-3-probe-${Date.now()}@example.com`;
  const createdUser = await db.auth.admin.createUser({
    email,
    password: "Sup3rSecret!12345",
    email_confirm: true,
  });
  if (createdUser.error || !createdUser.data.user) {
    throw new Error(`createUser failed: ${createdUser.error?.message}`);
  }

  const customerId = createdUser.data.user.id;
  const scheduledFor = new Date(Date.now() - 1000).toISOString();

  try {
    const first = await createJob(db, {
      type: "retention_cleanup",
      tenantId: customerId,
      idempotencyKey: `r5-3:first:${customerId}`,
      scheduledFor,
      payloadRef: {
        kind: "inline",
        redacted: true,
        preview: { probe: "first" },
      },
    });
    if (!first.ok) throw new Error(first.message);

    const claimed1 = await claimNextJob(db, { workerId: WORKER_ID, leaseSeconds: 45 });
    if (!claimed1.ok || !claimed1.data) {
      throw new Error(claimed1.ok ? "Expected first job to be claimed" : claimed1.message);
    }
    const running1 = await markJobRunning(db, claimed1.data.aio_job_id, claimed1.data.lease_token!);
    if (!running1.ok) throw new Error(running1.message);
    const completed1 = await completeJob(db, claimed1.data.aio_job_id, claimed1.data.lease_token!);
    if (!completed1.ok) throw new Error(completed1.message);

    const second = await createJob(db, {
      type: "retention_cleanup",
      tenantId: customerId,
      idempotencyKey: `r5-3:retry:${customerId}`,
      scheduledFor,
      payloadRef: {
        kind: "inline",
        redacted: true,
        preview: { probe: "retry" },
      },
    });
    if (!second.ok) throw new Error(second.message);

    const claimed2 = await claimNextJob(db, { workerId: WORKER_ID, leaseSeconds: 45 });
    if (!claimed2.ok || !claimed2.data) {
      throw new Error(claimed2.ok ? "Expected second job to be claimed" : claimed2.message);
    }
    const running2 = await markJobRunning(db, claimed2.data.aio_job_id, claimed2.data.lease_token!);
    if (!running2.ok) throw new Error(running2.message);

    const retried = await retryJob(db, claimed2.data.aio_job_id, {
      leaseToken: claimed2.data.lease_token!,
      retryAt: new Date(Date.now() - 1000).toISOString(),
      errorCode: "PROBE_RETRY",
      errorMessageRedacted: "probe retry path",
    });
    if (!retried.ok) throw new Error(retried.message);

    const released = await releaseDueRetryingJobs(db);
    if (!released.ok) throw new Error(released.message);

    const reclaimed = await claimNextJob(db, { workerId: WORKER_ID, leaseSeconds: 45 });
    if (!reclaimed.ok || !reclaimed.data) {
      throw new Error(reclaimed.ok ? "Expected retried job to be reclaimed" : reclaimed.message);
    }
    const rerunning = await markJobRunning(db, reclaimed.data.aio_job_id, reclaimed.data.lease_token!);
    if (!rerunning.ok) throw new Error(rerunning.message);
    const recompleted = await completeJob(
      db,
      reclaimed.data.aio_job_id,
      reclaimed.data.lease_token!,
    );
    if (!recompleted.ok) throw new Error(recompleted.message);

    const stale = await createJob(db, {
      type: "retention_cleanup",
      tenantId: customerId,
      idempotencyKey: `r5-3:stale:${customerId}`,
      scheduledFor,
      payloadRef: {
        kind: "inline",
        redacted: true,
        preview: { probe: "stale-lease" },
      },
    });
    if (!stale.ok) throw new Error(stale.message);

    const claimed3 = await claimNextJob(db, { workerId: WORKER_ID, leaseSeconds: 45 });
    if (!claimed3.ok || !claimed3.data) {
      throw new Error(claimed3.ok ? "Expected stale job to be claimed" : claimed3.message);
    }

    const forceExpired = await db
      .from("aio_jobs")
      .update({
        lease_expires_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("aio_job_id", claimed3.data.aio_job_id);
    if (forceExpired.error) throw new Error(forceExpired.error.message);

    const requeued = await requeueExpiredJobLeases(db, 5);
    if (!requeued.ok) throw new Error(requeued.message);

    const finalState = await getJob(db, claimed3.data.aio_job_id);
    if (!finalState.ok) throw new Error(finalState.message);

    console.log(
      JSON.stringify(
        {
          first: completed1.data.status,
          second: recompleted.data.status,
          staleLease: finalState.data.status,
          releasedRetryingJobs: released.data,
          requeuedExpiredLeases: requeued.data,
        },
        null,
        2,
      ),
    );
  } finally {
    const deleted = await db.auth.admin.deleteUser(customerId);
    if (deleted.error) {
      console.warn(`[r5-3-job-queue-probe] cleanup failed: ${deleted.error.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[r5-3-job-queue-probe] failed:", error);
  process.exit(1);
});
