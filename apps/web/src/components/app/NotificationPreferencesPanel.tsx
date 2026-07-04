"use client";

import { useEffect, useState } from "react";

// Self-contained R11.1 Notifications settings tab. Reads/writes the per-customer
// preferences row via /api/preferences (migration 0028). The per-schedule Discord
// toggle still lives in Scheduled Tasks; the flag here is the master switch.
export function NotificationPreferencesPanel() {
  const [notifyDiscord, setNotifyDiscord] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/preferences");
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to load preferences");
        if (alive) setNotifyDiscord(json.preferences.notifyDiscordGlobal);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggleDiscord = async (next: boolean) => {
    setSaving(true);
    setError(null);
    const prev = notifyDiscord;
    setNotifyDiscord(next);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyDiscordGlobal: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save");
      setNotifyDiscord(json.preferences.notifyDiscordGlobal);
    } catch (e) {
      setNotifyDiscord(prev);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="memory-text">Loading…</div>;

  return (
    <>
      {error && (
        <div className="memory-text" style={{ color: "#e25c5c", marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div className="setting-desc" style={{ marginBottom: 12 }}>
        Choose how Aio keeps you informed. In-app notifications (the bell) are always on.
      </div>

      <label
        className="mcp-server-item"
        style={{ cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}
      >
        <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
          <span style={{ fontSize: 14 }}>🔔</span>
        </div>
        <div className="mcp-server-info">
          <div className="mcp-server-name">Discord notifications</div>
          <div className="mcp-server-url">
            Master switch for Discord pings from scheduled tasks. Per-schedule toggles
            still apply and only fire when this is on.
          </div>
        </div>
        <input
          type="checkbox"
          checked={notifyDiscord ?? true}
          onChange={(e) => toggleDiscord(e.target.checked)}
          disabled={saving}
          style={{ width: 18, height: 18, flexShrink: 0 }}
        />
      </label>
    </>
  );
}
