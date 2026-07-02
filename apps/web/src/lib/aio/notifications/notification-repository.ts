import type { SupabaseClient } from "@supabase/supabase-js";

export const NOTIFICATION_REPO_ERROR_CODE = {
  DB_ERROR: "DB_ERROR",
} as const;

export type NotificationRepoErrorCode =
  (typeof NOTIFICATION_REPO_ERROR_CODE)[keyof typeof NOTIFICATION_REPO_ERROR_CODE];

export type NotificationRepoError = {
  ok: false;
  code: NotificationRepoErrorCode;
  message: string;
};

export type NotificationRepoOk<T> = { ok: true; data: T };
export type NotificationRepoResult<T> = NotificationRepoOk<T> | NotificationRepoError;

export type AioNotificationSource = "scheduled_task" | "research_run";

export interface AioNotificationRow {
  id: string;
  customer_id: string;
  source: AioNotificationSource;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

function dbError(message: string, detail?: unknown): NotificationRepoError {
  return {
    ok: false,
    code: NOTIFICATION_REPO_ERROR_CODE.DB_ERROR,
    message: detail ? `${message}: ${JSON.stringify(detail)}` : message,
  };
}

export async function createNotification(
  db: SupabaseClient,
  input: {
    customerId: string;
    source: AioNotificationSource;
    title: string;
    body?: string | null;
  },
): Promise<NotificationRepoResult<AioNotificationRow>> {
  const { data, error } = await db
    .from("aio_notifications")
    .insert({
      customer_id: input.customerId,
      source: input.source,
      title: input.title,
      body: input.body ?? null,
    })
    .select("*")
    .single();

  if (error) return dbError("Failed to create notification", error.message);
  return { ok: true, data: data as AioNotificationRow };
}

export async function listNotificationsForCustomer(
  db: SupabaseClient,
  customerId: string,
  limit: number,
): Promise<NotificationRepoResult<AioNotificationRow[]>> {
  const { data, error } = await db
    .from("aio_notifications")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return dbError("Failed to list notifications", error.message);
  return { ok: true, data: (data ?? []) as AioNotificationRow[] };
}

export async function countUnreadNotifications(
  db: SupabaseClient,
  customerId: string,
): Promise<NotificationRepoResult<number>> {
  const { count, error } = await db
    .from("aio_notifications")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .is("read_at", null);

  if (error) return dbError("Failed to count unread notifications", error.message);
  return { ok: true, data: count ?? 0 };
}

export async function markNotificationRead(
  db: SupabaseClient,
  id: string,
  customerId: string,
): Promise<NotificationRepoResult<AioNotificationRow>> {
  const { data, error } = await db
    .from("aio_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("customer_id", customerId)
    .select("*")
    .single();

  if (error) return dbError("Failed to mark notification read", error.message);
  return { ok: true, data: data as AioNotificationRow };
}

export async function markAllNotificationsRead(
  db: SupabaseClient,
  customerId: string,
): Promise<NotificationRepoResult<null>> {
  const { error } = await db
    .from("aio_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .is("read_at", null);

  if (error) return dbError("Failed to mark all notifications read", error.message);
  return { ok: true, data: null };
}

export function serializeNotificationForUi(row: AioNotificationRow) {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    body: row.body,
    read: row.read_at !== null,
    created_at: row.created_at,
  };
}
