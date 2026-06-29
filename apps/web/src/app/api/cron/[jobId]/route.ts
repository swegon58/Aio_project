import {
  deleteSchedule,
  pauseSchedule,
  resumeSchedule,
  serializeScheduleForUi,
  triggerScheduleNow,
  updateSchedule,
} from "@/lib/aio/schedules/schedule-repository";
import {
  requireCronAccess,
  resolveScheduleApiContext,
  scheduleRepoErrorResponse,
} from "@/lib/aio/schedules/schedule-api";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
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

  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const result = await updateSchedule(db, jobId, userId, {
    name: typeof payload?.name === "string" ? payload.name.trim() : undefined,
    schedule:
      typeof payload?.schedule === "string" ? payload.schedule.trim() : undefined,
    prompt: typeof payload?.prompt === "string" ? payload.prompt.trim() : undefined,
    taskPayload:
      typeof payload?.prompt === "string"
        ? { prompt: payload.prompt.trim() }
        : undefined,
  });
  if (!result.ok) return scheduleRepoErrorResponse(result);

  return Response.json({ job: serializeScheduleForUi(result.data) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const ctxResult = await resolveScheduleApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId, planTier } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) return denied;

  const result = await deleteSchedule(db, jobId, userId);
  if (!result.ok) return scheduleRepoErrorResponse(result);

  return Response.json({ ok: true });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const ctxResult = await resolveScheduleApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId, planTier } = ctxResult.ctx;

  const denied = requireCronAccess(planTier);
  if (denied) return denied;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (!["pause", "resume", "run"].includes(action ?? "")) {
    return Response.json({ error: "invalid_action", message: "Invalid action." }, { status: 400 });
  }

  const result =
    action === "pause"
      ? await pauseSchedule(db, jobId, userId, "paused from Aio")
      : action === "resume"
        ? await resumeSchedule(db, jobId, userId)
        : await triggerScheduleNow(db, jobId, userId);

  if (!result.ok) return scheduleRepoErrorResponse(result);

  return Response.json({ job: serializeScheduleForUi(result.data) });
}
