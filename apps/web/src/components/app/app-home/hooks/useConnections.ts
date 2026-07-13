import { useEffect, useState } from "react";
import { friendlyFetchError } from "@/lib/aio/friendly-fetch-error";
import type { ConnectionStatus } from "@/components/app/app-home-types";

interface UseConnectionsParams {
  settingsOpen: boolean;
  scheduledTasksOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setSettingsInitialTab: (tab: "general" | "data" | "connections") => void;
  logMeta: (text: string) => void;
}

// Platform connections (tokens + MCP servers + Google Calendar), extracted
// verbatim from AppHome.tsx. Settings/scheduled-tasks modal-open state stays
// lifted at the shell (shared across several domain hooks) and is passed in.
export function useConnections({
  settingsOpen,
  scheduledTasksOpen,
  setSettingsOpen,
  setSettingsInitialTab,
  logMeta,
}: UseConnectionsParams) {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  // Read-only left-sidebar "Integrations" list (#14 MCP surfacing, R11.3) —
  // reuses the existing GET /api/integrations/mcp (real Hermes config.yaml
  // read), just displayed without the word "MCP" per the confirmed brief.
  const [mcpServers, setMcpServers] = useState<{ name: string; enabled: boolean }[] | null>(null);
  const [tokenPlatform, setTokenPlatform] = useState("");
  const [tokenValue, setTokenValue] = useState("");
  const [tokenSubmitting, setTokenSubmitting] = useState(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<{
    configured: boolean;
    connected: boolean;
    googleEmail: string | null;
  } | null>(null);
  const [googleCalendarError, setGoogleCalendarError] = useState<string | null>(null);
  const [googleCalendarDisconnecting, setGoogleCalendarDisconnecting] = useState(false);

  const loadConnections = async () => {
    setConnectionsError(null);
    try {
      const res = await fetch("/api/connections");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      setConnections(data.platforms);
      if (!tokenPlatform && data.platforms?.[0]) {
        setTokenPlatform(data.platforms[0].id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConnectionsError(msg);
    }
  };

  useEffect(() => {
    if ((settingsOpen || scheduledTasksOpen) && connections === null) {
      loadConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, scheduledTasksOpen]);

  // ponytail: best-effort sidebar list — silent no-op on failure (no
  // profile yet, config unreadable) rather than an error state, since this
  // is a passive read-only glance, not a primary flow.
  useEffect(() => {
    fetch("/api/integrations/mcp")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMcpServers(data?.servers ?? null))
      .catch(() => setMcpServers(null));
  }, []);

  const loadGoogleCalendarStatus = async () => {
    setGoogleCalendarError(null);
    try {
      const res = await fetch("/api/connections/google");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      setGoogleCalendarStatus({
        configured: data.configured,
        connected: data.connected,
        googleEmail: data.googleEmail,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGoogleCalendarError(msg);
    }
  };

  useEffect(() => {
    if (settingsOpen && googleCalendarStatus === null) {
      loadGoogleCalendarStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  // Reopen Settings on the Connections tab after the Google OAuth callback
  // redirects back here (see /api/connections/google/callback).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("google_calendar")) return;
    setSettingsInitialTab("connections");
    setSettingsOpen(true);
    setGoogleCalendarStatus(null);
    params.delete("google_calendar");
    params.delete("google_calendar_detail");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, []);

  const handleGoogleCalendarDisconnect = async () => {
    setGoogleCalendarDisconnecting(true);
    try {
      const res = await fetch("/api/connections/google/disconnect", { method: "POST" });
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      await loadGoogleCalendarStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGoogleCalendarError(msg);
    } finally {
      setGoogleCalendarDisconnecting(false);
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenPlatform || !tokenValue.trim()) return;
    setTokenSubmitting(true);
    setTokenMessage(null);
    try {
      const res = await fetch("/api/connections/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: tokenPlatform, token: tokenValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenMessage(data.message ?? "Failed to save token");
      } else {
        setTokenValue("");
        setTokenMessage("Saved. Restart the gateway for it to take effect.");
        logMeta(`Saved ${tokenPlatform} connection token`);
        await loadConnections();
      }
    } catch (err) {
      setTokenMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTokenSubmitting(false);
    }
  };

  const handleTokenRemove = async (platformId: string) => {
    setTokenSubmitting(true);
    setTokenMessage(null);
    try {
      const res = await fetch("/api/connections/token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenMessage(data.message ?? "Failed to remove token");
      } else {
        setTokenMessage("Removed. Restart the gateway for it to take effect.");
        logMeta(`Removed ${platformId} connection token`);
        await loadConnections();
      }
    } catch (err) {
      setTokenMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTokenSubmitting(false);
    }
  };

  return {
    connections,
    connectionsError,
    mcpServers,
    tokenPlatform,
    setTokenPlatform,
    tokenValue,
    setTokenValue,
    tokenSubmitting,
    tokenMessage,
    handleTokenSubmit,
    handleTokenRemove,
    googleCalendarStatus,
    googleCalendarError,
    googleCalendarDisconnecting,
    handleGoogleCalendarDisconnect,
  };
}
