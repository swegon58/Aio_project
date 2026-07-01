"use client";

import { useRef, useState } from "react";
import { Bot, CreditCard, Database, FileText, KeyRound, Lock, Palette, Plug, Server, Shield, Trash2, X } from "lucide-react";
import { ALL_GATEABLE_TOOLSETS, TIERS, type PlanTier } from "@/lib/hermes/pricing";
import { PanelEmpty, PanelLoading } from "@/components/ui/panel-state";
import { KnowledgeCenterPanel } from "@/components/app/KnowledgeCenterPanel";
import { SavedAgentsPanel } from "@/components/app/SavedAgentsPanel";

type Theme = "dark" | "light";
type AccentKey = "purple" | "green" | "blue" | "pink" | "orange" | "cyan" | "red";
type SettingsTab = "general" | "connections" | "credentials" | "knowledge" | "savedAgents" | "plan" | "data";

const SETTINGS_TABS = [
  { key: "general", label: "Personalization", icon: Palette },
  { key: "connections", label: "Connected Apps", icon: Plug },
  { key: "credentials", label: "Model Providers", icon: KeyRound },
  { key: "knowledge", label: "Knowledge", icon: Database },
  { key: "savedAgents", label: "Saved Agents", icon: Bot },
  { key: "plan", label: "Plan", icon: CreditCard },
  { key: "data", label: "Data & Privacy", icon: Shield },
] satisfies { key: SettingsTab; label: string; icon: typeof Palette }[];

// Human-readable labels for the gateable Hermes toolset IDs (Q2 of the
// tier-toolset-gating grill — UI surfaces real toolset IDs as friendly names).
const TOOLSET_LABELS: Record<string, string> = {
  clarify: "Plan Mode (Clarify)",
  todo: "Task Tracking",
  web: "Web Search",
  code_execution: "Code Execution",
  browser: "Browser Automation",
  vision: "Vision (Image Understanding)",
  memory: "Persistent Memory",
  delegation: "Task Delegation",
  image_gen: "Image Generation",
  video_gen: "Video Generation",
  cronjob: "Scheduled Tasks",
  tts: "Text-to-Speech",
  skills: "Skills",
};

const ACCENTS: { key: AccentKey; hex: string }[] = [
  { key: "purple", hex: "#6c5ce7" },
  { key: "green", hex: "#00d2a0" },
  { key: "blue", hex: "#0081f2" },
  { key: "pink", hex: "#fd79a8" },
  { key: "orange", hex: "#ffa726" },
  { key: "cyan", hex: "#00cec9" },
  { key: "red", hex: "#ff6b6b" },
];

interface ConnectionStatus {
  id: string;
  label: string;
  tokenEnvVar: string;
  connected: boolean;
}

interface CredentialStatus {
  id: string;
  label: string;
  envVar: string;
  set: boolean;
  masked: string | null;
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  accent: AccentKey;
  onAccentChange: (accent: AccentKey) => void;

  connections: ConnectionStatus[] | null;
  connectionsError: string | null;
  tokenPlatform: string;
  onTokenPlatformChange: (value: string) => void;
  tokenValue: string;
  onTokenValueChange: (value: string) => void;
  tokenSubmitting: boolean;
  tokenMessage: string | null;
  onTokenSubmit: (e: React.FormEvent) => void;
  onTokenRemove: (platformId: string) => void;

  credentials: CredentialStatus[] | null;
  credentialsError: string | null;
  credentialId: string;
  onCredentialIdChange: (value: string) => void;
  credentialValue: string;
  onCredentialValueChange: (value: string) => void;
  credentialSubmitting: boolean;
  credentialMessage: string | null;
  onCredentialSubmit: (e: React.FormEvent) => void;

  onExportData: () => void;
  exportLoading: boolean;
  exportStatus: string | null;
  onDeleteAccount: () => void;
  deleteLoading: boolean;
  deleteStatus: string | null;

  currentPlanTier: string | null;
}

// Settings modal markup/CSS ported from ai_agent_webapp (Copy 2).html's
// #settingsModal, then adapted to Aio's current English product copy.
// Keep this surface limited to settings that are wired today or manage real
// account/workspace resources. Avoid visual-only toggles that imply runtime
// behavior the backend does not yet support.
export function SettingsModal({
  open,
  onClose,
  initialTab,
  theme,
  onThemeChange,
  accent,
  onAccentChange,
  connections,
  connectionsError,
  tokenPlatform,
  onTokenPlatformChange,
  tokenValue,
  onTokenValueChange,
  tokenSubmitting,
  tokenMessage,
  onTokenSubmit,
  onTokenRemove,
  credentials,
  credentialsError,
  credentialId,
  onCredentialIdChange,
  credentialValue,
  onCredentialValueChange,
  credentialSubmitting,
  credentialMessage,
  onCredentialSubmit,
  onExportData,
  exportLoading,
  exportStatus,
  onDeleteAccount,
  deleteLoading,
  deleteStatus,
  currentPlanTier,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "general");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const confirmRemoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [upgradingTier, setUpgradingTier] = useState<PlanTier | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");

  const handleUpgrade = async (targetTier: PlanTier) => {
    setUpgradingTier(targetTier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "plan", planTier: targetTier }),
      });
      if (!res.ok) throw new Error(await res.text());
      const session = await res.json();
      window.location.href = session.url;
    } catch (err) {
      console.error("Upgrade checkout failed:", err);
      setUpgradingTier(null);
    }
  };

  const requestConfirm = (id: string, onConfirm: () => void) => {
    if (confirmRemoveId === id) {
      if (confirmRemoveTimeoutRef.current) clearTimeout(confirmRemoveTimeoutRef.current);
      setConfirmRemoveId(null);
      onConfirm();
      return;
    }
    setConfirmRemoveId(id);
    if (confirmRemoveTimeoutRef.current) clearTimeout(confirmRemoveTimeoutRef.current);
    confirmRemoveTimeoutRef.current = setTimeout(
      () => setConfirmRemoveId((cur) => (cur === id ? null : cur)),
      3000,
    );
  };

  if (!open) return null;
  const activeTab = SETTINGS_TABS.find((item) => item.key === tab) ?? SETTINGS_TABS[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="settings-sidebar" aria-label="Settings">
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
          <div id="settings-dialog-title" className="settings-sidebar-title">Settings</div>
          <nav className="settings-nav">
            {SETTINGS_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`settings-nav-item${tab === key ? " active" : ""}`}
                onClick={() => setTab(key)}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="settings-content">
          <div className="settings-content-header">
            <h2>{activeTab.label}</h2>
          </div>
          <div className="settings-content-body">

        {tab === "general" && (
          <>
            <div className="setting-group">
              <div className="setting-label">Appearance</div>
              <div className="setting-desc">Choose how Aio looks on this device.</div>
              <div className="theme-selector">
                <button
                  className={`theme-option dark${theme === "dark" ? " active" : ""}`}
                  onClick={() => onThemeChange("dark")}
                  aria-label="Dark"
                >
                  Dark
                </button>
                <button
                  className={`theme-option light${theme === "light" ? " active" : ""}`}
                  onClick={() => onThemeChange("light")}
                  aria-label="Light"
                >
                  Light
                </button>
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-label">Accent Color</div>
              <div className="setting-desc">Set the highlight color used across the workspace.</div>
              <div className="accent-colors">
                {ACCENTS.map((a) => (
                  <button
                    key={a.key}
                    className={`accent-color ${a.key}${accent === a.key ? " active" : ""}`}
                    onClick={() => onAccentChange(a.key)}
                    aria-label={a.key}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "connections" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            {connectionsError && (
              <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                Failed to load: {connectionsError}
              </div>
            )}

            {connections === null && !connectionsError && <PanelLoading />}

            {connections?.map((c) => (
              <div key={c.id} className="mcp-server-item">
                <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                  <Server className="w-3.5 h-3.5" />
                </div>
                <div className="mcp-server-info">
                  <div className="mcp-server-name">{c.label}</div>
                  <div className="mcp-server-url">{c.tokenEnvVar}</div>
                </div>
                <div className={`mcp-server-status ${c.connected ? "connected" : "disconnected"}`} />
                {c.connected && (
                  <button
                    type="button"
                    className="mcp-add-btn"
                    style={
                      confirmRemoveId === c.id
                        ? { padding: "4px 8px", fontSize: 12, background: "rgba(226, 92, 92, 0.12)", color: "#e25c5c" }
                        : { padding: "4px 8px", fontSize: 12 }
                    }
                    disabled={tokenSubmitting}
                    title={confirmRemoveId === c.id ? "Click again to remove" : "Remove token"}
                    onClick={() => requestConfirm(c.id, () => onTokenRemove(c.id))}
                  >
                    {confirmRemoveId === c.id ? "Confirm?" : "Remove"}
                  </button>
                )}
              </div>
            ))}

            <div className="panel-section-title" style={{ marginTop: 16 }}>
              Add or update app access
            </div>
            <form onSubmit={onTokenSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                value={tokenPlatform}
                onChange={(e) => onTokenPlatformChange(e.target.value)}
                className="message-input"
                style={{ height: 32 }}
              >
                {connections?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="password"
                value={tokenValue}
                onChange={(e) => onTokenValueChange(e.target.value)}
                placeholder="Paste access token"
                className="message-input"
                style={{ height: 32 }}
              />
              <button
                type="submit"
                className="mcp-add-btn"
                disabled={tokenSubmitting || !tokenPlatform || !tokenValue.trim()}
              >
                {tokenSubmitting ? "Saving…" : "Save access"}
              </button>
              {tokenMessage && <div className="memory-text">{tokenMessage}</div>}
            </form>
          </div>
        )}

        {tab === "credentials" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            {credentialsError && (
              <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                Failed to load: {credentialsError}
              </div>
            )}

            {credentials === null && !credentialsError && <PanelLoading />}

            {credentials?.map((c) => (
              <div key={c.id} className="mcp-server-item">
                <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                  <Server className="w-3.5 h-3.5" />
                </div>
                <div className="mcp-server-info">
                  <div className="mcp-server-name">{c.label}</div>
                  <div className="mcp-server-url">{c.set ? c.masked : "not set"}</div>
                </div>
                <div className={`mcp-server-status ${c.set ? "connected" : "disconnected"}`} />
              </div>
            ))}

            <div className="panel-section-title" style={{ marginTop: 16 }}>
              Add or update provider key
            </div>
            <form onSubmit={onCredentialSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                value={credentialId}
                onChange={(e) => onCredentialIdChange(e.target.value)}
                className="message-input"
                style={{ height: 32 }}
              >
                {credentials?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="password"
                value={credentialValue}
                onChange={(e) => onCredentialValueChange(e.target.value)}
                placeholder="Paste API key"
                className="message-input"
                style={{ height: 32 }}
              />
              <button
                type="submit"
                className="mcp-add-btn"
                disabled={credentialSubmitting || !credentialId || !credentialValue.trim()}
              >
                {credentialSubmitting ? "Saving…" : "Save provider key"}
              </button>
              {credentialMessage && <div className="memory-text">{credentialMessage}</div>}
            </form>
          </div>
        )}

        {tab === "knowledge" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            <KnowledgeCenterPanel />
          </div>
        )}

        {tab === "savedAgents" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            <SavedAgentsPanel />
          </div>
        )}

        {tab === "plan" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            {(() => {
              const tierKey = (currentPlanTier as PlanTier) ?? "starter";
              const tierCfg = TIERS[tierKey] ?? TIERS.starter;
              return (
                <>
                  <div className="panel-section-title" style={{ marginTop: 0 }}>
                    Current plan: {tierCfg.label} (${tierCfg.monthlyPriceUsd}/mo)
                  </div>
                  <div className="memory-text" style={{ marginBottom: 12 }}>
                    Each task can use up to {tierCfg.caps.creditBudget.toLocaleString()} credits
                    before Aio pauses it — you can reply to keep going or start a new task.
                  </div>

                  {ALL_GATEABLE_TOOLSETS.map((id) => {
                    const unlocked = tierCfg.toolsets.includes(id);
                    const targetTier = (["starter", "pro", "business"] as PlanTier[]).find(
                      (t) => TIERS[t].toolsets.includes(id),
                    );
                    return (
                      <div
                        key={id}
                        className="mcp-server-item"
                        style={{ opacity: unlocked ? 1 : 0.5 }}
                      >
                        <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                          {unlocked ? <Server className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </div>
                        <div className="mcp-server-info">
                          <div className="mcp-server-name">{TOOLSET_LABELS[id] ?? id}</div>
                          {!unlocked && (
                            <div className="mcp-server-url">Not included in {tierCfg.label}</div>
                          )}
                        </div>
                        {unlocked ? (
                          <div className="mcp-server-status connected" />
                        ) : (
                          <button
                            type="button"
                            className="mcp-add-btn"
                            style={{ width: "auto", flexShrink: 0, padding: "4px 10px", fontSize: 12 }}
                            disabled={!targetTier || upgradingTier === targetTier}
                            onClick={() => targetTier && handleUpgrade(targetTier)}
                          >
                            {upgradingTier === targetTier ? "Redirecting…" : `Upgrade to ${TIERS[targetTier ?? "pro"].label}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
        )}
        {tab === "data" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            <div className="panel-section-title" style={{ marginTop: 0 }}>
              Download your data
            </div>
            <div className="setting-desc" style={{ marginBottom: 12 }}>
              Export everything Aio holds about your account as a JSON file — your conversations,
              runs, knowledge sources, schedules, and gallery.
            </div>
            <button
              type="button"
              className="mcp-add-btn"
              style={{ width: "auto" }}
              disabled={exportLoading}
              onClick={onExportData}
            >
              {exportLoading ? "Preparing…" : "Download my data"}
            </button>
            {exportStatus && <div className="memory-text" style={{ marginTop: 8 }}>{exportStatus}</div>}

            <div className="panel-section-title" style={{ marginTop: 28 }}>Delete account</div>
            <div className="setting-desc" style={{ marginBottom: 12 }}>
              Permanently delete your account, conversations, runs, knowledge, and gallery. This
              cannot be undone. To manage a single knowledge source instead, use the Knowledge tab.
            </div>
            {!deleteArmed ? (
              <button
                type="button"
                className="mcp-add-btn"
                style={{ width: "auto", color: "#e25c5c", borderColor: "rgba(226, 92, 92, 0.4)" }}
                disabled={deleteLoading}
                onClick={() => setDeleteArmed(true)}
              >
                Delete my account
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="text"
                  value={deletePhrase}
                  onChange={(e) => setDeletePhrase(e.target.value)}
                  placeholder='Type DELETE to confirm'
                  style={{
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--glass-border)",
                    background: "var(--glass-bg)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                  }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="mcp-add-btn"
                    style={{ width: "auto", color: "#e25c5c", background: "rgba(226, 92, 92, 0.12)" }}
                    disabled={deletePhrase !== "DELETE" || deleteLoading}
                    onClick={onDeleteAccount}
                  >
                    {deleteLoading ? "Deleting…" : "Permanently delete"}
                  </button>
                  <button
                    type="button"
                    className="mcp-add-btn"
                    style={{ width: "auto" }}
                    disabled={deleteLoading}
                    onClick={() => { setDeleteArmed(false); setDeletePhrase(""); }}
                  >
                    Cancel
                  </button>
                </div>
                {deleteStatus && <div className="memory-text" style={{ color: "#e25c5c" }}>{deleteStatus}</div>}
              </div>
            )}
          </div>
        )}
          </div>
        </section>
      </div>
    </div>
  );
}

export type { AccentKey };
