import {
  createSchedule,
  listSchedulesForCustomer,
  serializeScheduleForUi,
} from "@/lib/aio/schedules/schedule-repository";
import {
  requireCronAccess,
  resolveScheduleApiContext,
  scheduleRepoErrorResponse,
} from "@/lib/aio/schedules/schedule-api";

export async function GET() {
  const ctxResult = await resolveScheduleApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId, planTier } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) {
    return Response.json({
      locked: true,
      jobs: [],
      error: "Scheduled tasks require the Business plan.",
    });
  }

  const result = await listSchedulesForCustomer(db, userId);
  if (!result.ok) return scheduleRepoErrorResponse(result);

  return Response.json({
    jobs: result.data.map(serializeScheduleForUi),
  });
}

export async function POST(req: Request) {
  const ctxResult = await resolveScheduleApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId, planTier } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_json", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const payload = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  const schedule = typeof payload?.schedule === "string" ? payload.schedule.trim() : "";
  const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";

  if (!name) {
    return Response.json(
      { error: "missing_name", message: "name is required." },
      { status: 400 },
    );
  }
  if (!schedule) {
    return Response.json(
      { error: "missing_schedule", message: "schedule is required." },
      { status: 400 },
    );
  }

  const result = await createSchedule(db, {
    customerId: userId,
    name,
    schedule,
    prompt,
    taskPayload: {
      prompt,
    },
  });
  if (!result.ok) return scheduleRepoErrorResponse(result);

  return Response.json({
    job: serializeScheduleForUi(result.data),
  });
}
