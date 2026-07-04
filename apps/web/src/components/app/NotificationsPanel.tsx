"use client";

import { useRef } from "react";
import { Bell, CheckCircle2, ListChecks, Loader2, Search, X } from "lucide-react";
import type { AioNotification } from "@/components/app/app-home-types";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  notifications: AioNotification[] | null;
  unreadCount: number;
  error: string | null;
  onRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const SOURCE_ICON = {
  scheduled_task: ListChecks,
  research_run: Search,
} as const;

export function NotificationsPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  error,
  onRead,
  onMarkAllRead,
}: NotificationsPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, onClose);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-dialog-title"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="notifications-dialog-title">Notifications</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3" aria-live="polite">
          {error && (
            <div role="status" className="text-[12px] text-red-400 bg-red-400/10 rounded-md px-3 py-2">
              Failed to load notifications: {error}
            </div>
          )}

          {notifications === null && !error && (
            <div role="status" className="flex items-center gap-2 text-[12px] text-[var(--text-muted)] py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications…
            </div>
          )}

          {notifications?.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-[var(--text-muted)]">
              <Bell className="h-8 w-8 opacity-40" />
              <p className="text-[12px]">No notifications yet.</p>
            </div>
          )}

          {notifications && notifications.length > 0 && unreadCount > 0 && (
            <button
              type="button"
              className="mcp-add-btn"
              style={{ width: "auto", flexShrink: 0, alignSelf: "flex-end", padding: "4px 8px" }}
              onClick={onMarkAllRead}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}

          {notifications?.map((n) => {
            const Icon = SOURCE_ICON[n.source];
            return (
              <div
                key={n.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-elevated)] px-3 py-2"
                style={n.read ? undefined : { borderColor: "var(--accent-primary)" }}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover)]">
                  <Icon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                    {n.title}
                  </div>
                  <div className="truncate text-[11px] text-[var(--text-muted)]">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    className="mcp-add-btn"
                    style={{ width: "auto", flexShrink: 0, padding: "4px 8px" }}
                    onClick={() => onRead(n.id)}
                    aria-label="Mark read"
                    title="Mark read"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
