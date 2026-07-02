import {
  countUnreadNotifications,
  listNotificationsForCustomer,
  markAllNotificationsRead,
  serializeNotificationForUi,
} from "@/lib/aio/notifications/notification-repository";
import { resolveRunApiContext, parseBoundedInt } from "@/lib/aio/runs/run-api";

// GET /api/notifications — R10.2: in-app notification feed + unread count.
export async function GET(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  const url = new URL(req.url);
  const limit = parseBoundedInt(url.searchParams.get("limit"), {
    defaultValue: 20,
    min: 1,
    max: 100,
  });
  if (limit === null) {
    return Response.json({ error: "invalid_limit", message: "Invalid limit." }, { status: 400 });
  }

  const [listResult, unreadResult] = await Promise.all([
    listNotificationsForCustomer(db, userId, limit),
    countUnreadNotifications(db, userId),
  ]);

  if (!listResult.ok) {
    return Response.json({ error: listResult.code, message: listResult.message }, { status: 500 });
  }
  if (!unreadResult.ok) {
    return Response.json({ error: unreadResult.code, message: unreadResult.message }, { status: 500 });
  }

  return Response.json({
    notifications: listResult.data.map(serializeNotificationForUi),
    unreadCount: unreadResult.data,
  });
}

// POST /api/notifications?action=mark-all-read
export async function POST(req: Request) {
  const ctxResult = await resolveRunApiContext();
  if (!ctxResult.ok) return ctxResult.response;
  const { db, userId } = ctxResult.ctx;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (action !== "mark-all-read") {
    return Response.json({ error: "invalid_action", message: "Invalid action." }, { status: 400 });
  }

  const result = await markAllNotificationsRead(db, userId);
  if (!result.ok) {
    return Response.json({ error: result.code, message: result.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
