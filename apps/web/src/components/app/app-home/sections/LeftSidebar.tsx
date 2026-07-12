"use client";

import { Plug, X } from "lucide-react";
import { useAccountData, useWorkspace } from "@/components/app/app-home/context";

interface LeftSidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export function LeftSidebar({ sidebarCollapsed, setSidebarCollapsed }: LeftSidebarProps) {
  const { terminalOpen } = useWorkspace();
  const { mcpServers } = useAccountData();
  // This panel only ever renders MCP integrations — with none connected it's
  // an empty 272px box (a dead "gutter" between the icon rail and chat).
  // Force it collapsed whenever there's nothing to show.
  const hasContent = Boolean(mcpServers && mcpServers.length > 0);

  return (
    <aside
      className={`sidebar${
        sidebarCollapsed || terminalOpen || !hasContent ? " collapsed" : ""
      }`}
    >
      <div className="sidebar-header">
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={() => setSidebarCollapsed(true)}
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {mcpServers && mcpServers.length > 0 && (
        <div className="sidebar-section" style={{ borderTop: "1px solid var(--border-color)", paddingTop: 10 }}>
          <div className="sidebar-section-title">Integrations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {mcpServers.map((s) => (
              <div key={s.name} className="mcp-server-item" style={{ marginBottom: 0 }}>
                <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                  <Plug className="w-3.5 h-3.5" />
                </div>
                <div className="mcp-server-info">
                  <div className="mcp-server-name">{s.name}</div>
                </div>
                <div className={`mcp-server-status ${s.enabled ? "connected" : "disconnected"}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
