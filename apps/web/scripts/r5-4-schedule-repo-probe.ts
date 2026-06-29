import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createServiceClient } from "../src/lib/supabase/service";
import {
  createSchedule,
  createScheduleRun,
  deleteSchedule,
  listSchedulesForCustomer,
  pauseSchedule,
  resumeSchedule,
  updateSchedule,
} from "../src/lib/aio/schedules/schedule-repository";

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

async function main() {
  const email = `r5-4-probe-${Date.now()}@example.com`;
  const createdUser = await db.auth.admin.createUser({
    email,
    password: "Sup3rSecret!12345",
    email_confirm: true,
  });
  if (createdUser.error || !createdUser.data.user) {
    throw new Error(`createUser failed: ${createdUser.error?.message}`);
  }

  const customerId = createdUser.data.user.id;

  try {
    const created = await createSchedule(db, {
      customerId,
      name: "Morning review",
      schedule: "every 30m",
      prompt: "Review new updates",
    });
    if (!created.ok) throw new Error(created.message);

    const listed1 = await listSchedulesForCustomer(db, customerId);
    if (!listed1.ok || listed1.data.length !== 1) {
      throw new Error("Expected exactly one schedule after create");
    }

    const paused = await pauseSchedule(
      db,
      created.data.aio_schedule_id,
      customerId,
      "probe pause",
    );
    if (!paused.ok || paused.data.state !== "paused") {
      throw new Error(paused.ok ? "Expected paused state" : paused.message);
    }

    const resumed = await resumeSchedule(db, created.data.aio_schedule_id, customerId);
    if (!resumed.ok || resumed.data.state !== "scheduled") {
      throw new Error(resumed.ok ? "Expected scheduled state after resume" : resumed.message);
    }

    const updated = await updateSchedule(db, created.data.aio_schedule_id, customerId, {
      name: "One-shot review",
      schedule: "2026-07-01T14:30:00Z",
    });
    if (!updated.ok || updated.data.schedule_kind !== "once") {
      throw new Error(updated.ok ? "Expected one-shot schedule after update" : updated.message);
    }

    const run = await createScheduleRun(db, {
      customerId,
      aioScheduleId: created.data.aio_schedule_id,
      triggerKind: "manual",
      occurrenceAt: "2026-07-01T14:30:00.000Z",
      occurrenceKey: "manual:2026-07-01T14:30:00.000Z",
    });
    if (!run.ok) throw new Error(run.message);

    const duplicate = await createScheduleRun(db, {
      customerId,
      aioScheduleId: created.data.aio_schedule_id,
      triggerKind: "manual",
      occurrenceAt: "2026-07-01T14:30:00.000Z",
      occurrenceKey: "manual:2026-07-01T14:30:00.000Z",
    });
    if (duplicate.ok || duplicate.code !== "DUPLICATE_RUN") {
      throw new Error("Expected duplicate schedule run to be rejected");
    }

    const deleted = await deleteSchedule(db, created.data.aio_schedule_id, customerId);
    if (!deleted.ok) throw new Error(deleted.message);

    const listed2 = await listSchedulesForCustomer(db, customerId);
    if (!listed2.ok || listed2.data.length !== 0) {
      throw new Error("Expected zero schedules after delete");
    }

    console.log(
      JSON.stringify(
        {
          createdKind: created.data.schedule_kind,
          pausedState: paused.data.state,
          resumedState: resumed.data.state,
          updatedKind: updated.data.schedule_kind,
          runStatus: run.data.status,
          duplicateCode: duplicate.code,
          remainingSchedules: listed2.data.length,
        },
        null,
        2,
      ),
    );
  } finally {
    const deletedUser = await db.auth.admin.deleteUser(customerId);
    if (deletedUser.error) {
      console.warn(`[r5-4-schedule-repo-probe] cleanup failed: ${deletedUser.error.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[r5-4-schedule-repo-probe] failed:", error);
  process.exit(1);
});
