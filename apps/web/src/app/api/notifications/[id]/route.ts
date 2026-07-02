import {
  markNotificationRead,
  serializeNotificationForUi,
} from "@/lib/aio/notifications/notification-repository";
import { resolveRunApiContext } from "@/lib/aio/runs/run-api";

// POST /api/notifications/[id] — R10.2: mark a single notification read.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;
  const { id } = await params;

  const result = await markNotificationRead(db, id, userId);
  if (!result.ok) {
    return Response.json({ error: result.code, message: result.message }, { status: 500 });
  }

  return Response.json({ notification: serializeNotificationForUi(result.data) });
}
