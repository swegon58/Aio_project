import { useEffect, useState } from "react";
import { friendlyFetchError } from "@/lib/aio/friendly-fetch-error";
import type { AioNotification } from "@/components/app/app-home-types";

// Notifications panel state + read/unread CRUD, extracted verbatim from
// AppHome.tsx. Fully self-contained — no cross-hook shared state.
export function useNotifications() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AioNotification[] | null>(null);
  const [notificationsUnread, setNotificationsUnread] = useState(0);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const loadNotifications = async () => {
    setNotificationsError(null);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setNotificationsUnread(data.unreadCount ?? 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotificationsError(msg);
    }
  };

  const handleNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? prev,
    );
    setNotificationsUnread((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: "POST" });
    } catch {
      // best-effort — local state already reflects the read
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    setNotificationsUnread(0);
    try {
      await fetch("/api/notifications?action=mark-all-read", { method: "POST" });
    } catch {
      // best-effort — local state already reflects the read
    }
  };

  // Unread badge on the icon rail should be populated without opening the panel.
  useEffect(() => {
    fetch("/api/notifications?limit=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { unreadCount: number } | null) => {
        if (data) setNotificationsUnread(data.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (notificationsOpen) loadNotifications();
  }, [notificationsOpen]);

  return {
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    notificationsUnread,
    notificationsError,
    handleNotificationRead,
    handleMarkAllNotificationsRead,
  };
}
