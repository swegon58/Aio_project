"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, CreditCard, FileText, KeyRound, Lock, Palette, Plug, Puzzle, Server, Shield, Trash2, User, X } from "lucide-react";
import { ALL_GATEABLE_TOOLSETS, TIERS, type PlanTier } from "@/lib/hermes/pricing";
import { PanelEmpty, PanelLoading } from "@/components/ui/panel-state";
import { NotificationPreferencesPanel } from "@/components/app/NotificationPreferencesPanel";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CREDENTIAL_CATEGORY_LABELS, type CredentialCategory } from "@/lib/hermes/credentials";
import type { FontKey } from "@/components/app/app-home/hooks/useAccountPrefs";

type Theme = "dark" | "light";
type AccentKey = "purple" | "green" | "blue" | "pink" | "orange" | "cyan" | "red";
// ponytail: 10→6 tabs (owner critique 2026-07-11) — Memory tab removed from
// nav (MemoryFactsPanel/backend data untouched, just unreachable via UI);
// Notifications folded into Account. Knowledge & Agents tab removed from nav
// 2026-07-11 (KnowledgeCenterPanel/SavedAgentsPanel/RetrievalValvesPanel
// backend data untouched, just unreachable via UI — same pattern as Memory).
type SettingsTab = "account" | "general" | "connections" | "skills" | "credentials" | "plan" | "data";

const SETTINGS_TABS = [
  { key: "account", label: "Account", icon: User },
  { key: "general", label: "Personalization", icon: Palette },
  { key: "connections", label: "Connected Apps", icon: Plug },
  { key: "skills", label: "Skills", icon: Puzzle },
  { key: "credentials", label: "Model Providers", icon: KeyRound },
  { key: "plan", label: "Plan", icon: CreditCard },
  { key: "data", label: "Data & Privacy", icon: Shield },
] satisfies { key: SettingsTab; label: string; icon: typeof Palette }[];

// Shared destructive-action button styles (outline = idle warning, filled = armed/confirm state).
const destructiveOutlineStyle: React.CSSProperties = {
  width: "auto",
  color: "var(--accent-red)",
  border: "1px solid color-mix(in srgb, var(--accent-red) 40%, transparent)",
};
const destructiveFilledStyle: React.CSSProperties = {
  width: "auto",
  color: "var(--accent-on-accent)",
  background: "var(--accent-red)",
};

// Small pill used by SkillsMarketplacePanel for category/source/trust tags.
const skillBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "1px 7px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid color-mix(in srgb, var(--border-color) 55%, transparent)",
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
};
const skillBadgeTrustedStyle: React.CSSProperties = {
  ...skillBadgeStyle,
  color: "var(--accent-green)",
  border: "1px solid color-mix(in srgb, var(--accent-green) 40%, transparent)",
};

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

const FONTS: { key: FontKey; label: string }[] = [
  { key: "inter", label: "Inter" },
  { key: "ibm-plex", label: "IBM Plex Sans" },
  { key: "source-sans", label: "Source Sans 3" },
  { key: "work-sans", label: "Work Sans" },
  { key: "system", label: "System UI" },
];

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

interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
}

interface CredentialStatus {
  id: string;
  label: string;
  envVar: string;
  category: CredentialCategory;
  set: boolean;
  masked: string | null;
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  userName?: string | null;
  userAvatarUrl?: string | null;
  email: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  accent: AccentKey;
  onAccentChange: (accent: AccentKey) => void;
  font: FontKey;
  onFontChange: (font: FontKey) => void;

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

  googleCalendarStatus: GoogleCalendarStatus | null;
  googleCalendarError: string | null;
  googleCalendarDisconnecting: boolean;
  onGoogleCalendarDisconnect: () => void;

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
  userName,
  userAvatarUrl,
  email,
  theme,
  onThemeChange,
  accent,
  onAccentChange,
  font,
  onFontChange,
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
  googleCalendarStatus,
  googleCalendarError,
  googleCalendarDisconnecting,
  onGoogleCalendarDisconnect,
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
  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const confirmRemoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [upgradingTier, setUpgradingTier] = useState<PlanTier | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, onClose);

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
        ref={dialogRef}
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

        {tab === "account" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            <div className="panel-section-title" style={{ marginTop: 0 }}>Profile</div>
            <div className="setting-desc" style={{ marginBottom: 16 }}>
              These details come from your sign-in. To change them, update the account you signed in with.
            </div>
            <div className="mcp-server-item">
              <div className="mcp-server-icon" style={{ background: "var(--bg-hover)", overflow: "hidden" }}>
                {userAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {(userName || email || "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="mcp-server-info">
                <div className="mcp-server-name">{userName || "Unnamed"}</div>
                <div className="mcp-server-url">{email}</div>
              </div>
            </div>
            <div className="panel-section-title" style={{ marginTop: 24 }}>Notifications</div>
            <NotificationPreferencesPanel />
          </div>
        )}

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

            <div className="setting-group" style={{ borderBottom: "none" }}>
              <div className="setting-label">Font</div>
              <div className="setting-desc">Choose the typeface used for chat and UI text.</div>
              <div className="font-selector">
                {FONTS.map((f) => (
                  <button
                    key={f.key}
                    className={`font-option${font === f.key ? " active" : ""}`}
                    onClick={() => onFontChange(f.key)}
                    aria-label={f.label}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "connections" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            {connectionsError && (
              <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>
                Failed to load: {connectionsError}
              </div>
            )}

            <div className="panel-section-title">Google Calendar</div>
            {googleCalendarError && (
              <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>
                Failed to load: {googleCalendarError}
              </div>
            )}
            {googleCalendarStatus === null && !googleCalendarError && <PanelLoading />}
            {googleCalendarStatus && (
              <div className="mcp-server-item">
                <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="mcp-server-info">
                  <div className="mcp-server-name">Google Calendar</div>
                  <div className="mcp-server-url">
                    {googleCalendarStatus.connected
                      ? googleCalendarStatus.googleEmail
                      : googleCalendarStatus.configured
                        ? "Aio can create and check events on your calendar"
                        : "Not available yet"}
                  </div>
                </div>
                <div className={`mcp-server-status ${googleCalendarStatus.connected ? "connected" : "disconnected"}`} />
                {googleCalendarStatus.connected ? (
                  <button
                    type="button"
                    className="mcp-add-btn"
                    style={
                      confirmRemoveId === "google_calendar"
                        ? { ...destructiveFilledStyle, flexShrink: 0, padding: "4px 8px", fontSize: 12 }
                        : { width: "auto", flexShrink: 0, padding: "4px 8px", fontSize: 12 }
                    }
                    disabled={googleCalendarDisconnecting}
                    title={confirmRemoveId === "google_calendar" ? "Click again to disconnect" : "Disconnect"}
                    onClick={() => requestConfirm("google_calendar", onGoogleCalendarDisconnect)}
                  >
                    {googleCalendarDisconnecting
                      ? "Disconnecting…"
                      : confirmRemoveId === "google_calendar"
                        ? "Confirm?"
                        : "Disconnect"}
                  </button>
                ) : (
                  <a
                    href="/api/connections/google/start"
                    className="mcp-add-btn"
                    style={
                      googleCalendarStatus.configured
                        ? { width: "auto", flexShrink: 0, padding: "4px 8px", fontSize: 12 }
                        : {
                            width: "auto",
                            flexShrink: 0,
                            padding: "4px 8px",
                            fontSize: 12,
                            pointerEvents: "none",
                            opacity: 0.5,
                          }
                    }
                  >
                    Connect
                  </a>
                )}
              </div>
            )}

            <div className="panel-section-title" style={{ marginTop: 16 }}>
              Other apps
            </div>
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
                        ? { ...destructiveFilledStyle, padding: "4px 8px", fontSize: 12 }
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

            <McpConnectionsPanel />
          </div>
        )}

        {tab === "skills" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            <SkillsMarketplacePanel />
          </div>
        )}

        {tab === "credentials" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            {credentialsError && (
              <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>
                Failed to load: {credentialsError}
              </div>
            )}

            {credentials === null && !credentialsError && <PanelLoading />}

            {credentials && (Object.keys(CREDENTIAL_CATEGORY_LABELS) as CredentialCategory[]).map((category) => {
              const items = credentials.filter((c) => c.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} style={{ marginBottom: 12 }}>
                  <div className="panel-section-title">{CREDENTIAL_CATEGORY_LABELS[category]}</div>
                  {items.map((c) => (
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
                </div>
              );
            })}

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
            <DataTrainingOptOutToggle />

            <div className="panel-section-title" style={{ marginTop: 28 }}>
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
                style={destructiveOutlineStyle}
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
                  className="message-input"
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="mcp-add-btn"
                    style={destructiveFilledStyle}
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
                {deleteStatus && <div className="memory-text" style={{ color: "var(--accent-red)" }}>{deleteStatus}</div>}
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

// Self-contained R11.1 data-use opt-out toggle in the Data & Privacy tab.
// Reads/writes the same /api/preferences row as the Notifications tab.
function DataTrainingOptOutToggle() {
  const [optOut, setOptOut] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/preferences");
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to load");
        if (alive) setOptOut(json.preferences.dataTrainingOptOut);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    setError(null);
    const prev = optOut;
    setOptOut(next);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataTrainingOptOut: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save");
      setOptOut(json.preferences.dataTrainingOptOut);
    } catch (e) {
      setOptOut(prev);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="panel-section-title" style={{ marginTop: 0 }}>Data use</div>
      <div className="setting-desc" style={{ marginBottom: 12 }}>
        Control whether your conversations and inputs may be used to improve Aio&apos;s models.
      </div>
      {error && (
        <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>{error}</div>
      )}
      <label
        className="mcp-server-item"
        style={{ cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}
      >
        <div className="mcp-server-info">
          <div className="mcp-server-name">Opt out of model training</div>
          <div className="mcp-server-url">
            When on, your data is not used to train or improve models.
          </div>
        </div>
        <input
          type="checkbox"
          checked={optOut ?? false}
          onChange={(e) => toggle(e.target.checked)}
          disabled={saving || optOut === null}
          style={{ width: 18, height: 18, flexShrink: 0 }}
        />
      </label>
    </>
  );
}

// R12: per-customer retrieval valves (knowledge_retrieval tool). Reads/writes
// /api/account/valves — same shape as DataTrainingOptOutToggle but for two
// numeric knobs. Slider value is bm25_weight (0=semantic, 1=lexical).
function RetrievalValvesPanel() {
  const [bm25Weight, setBm25Weight] = useState(0.5);
  const [matchCount, setMatchCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/account/valves?tool_id=knowledge_retrieval");
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to load");
        if (alive) {
          const v = json.valves ?? {};
          if (typeof v.bm25_weight === "number") setBm25Weight(v.bm25_weight);
          if (typeof v.match_count === "number") setMatchCount(v.match_count);
        }
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/valves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_id: "knowledge_retrieval",
          valves: { bm25_weight: bm25Weight, match_count: matchCount },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save");
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ marginBottom: 20 }}>
      <div className="panel-section-title" style={{ marginTop: 0 }}>Retrieval tuning</div>
      <div className="setting-desc" style={{ marginBottom: 12 }}>
        Control how Aio searches your knowledge base when you ask a question.
      </div>

      {loading ? (
        <PanelLoading />
      ) : (
        <>
          {error && (
            <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>{error}</div>
          )}
          <div className="setting-label" style={{ fontSize: 13 }}>
            Semantic ↔ lexical balance
          </div>
          <div className="memory-text" style={{ marginBottom: 6 }}>
            Lower favors meaning; higher favors exact keywords. Current: {bm25Weight.toFixed(1)}
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={bm25Weight}
            onChange={(e) => setBm25Weight(parseFloat(e.target.value))}
            disabled={saving}
            style={{ width: "100%", marginBottom: 16 }}
            aria-label="Semantic to lexical balance"
          />

          <div className="setting-label" style={{ fontSize: 13 }}>Results per search</div>
          <div className="memory-text" style={{ marginBottom: 6 }}>Number of passages retrieved (1–20).</div>
          <input
            type="number"
            min={1}
            max={20}
            value={matchCount}
            onChange={(e) =>
              setMatchCount(Math.max(1, Math.min(20, Number(e.target.value) || 5)))
            }
            disabled={saving}
            className="message-input"
            style={{ height: 32, width: 120, marginBottom: 12 }}
            aria-label="Results per search"
          />

          <button type="submit" className="mcp-add-btn" disabled={saving} style={{ width: "auto" }}>
            {saving ? "Saving…" : "Save retrieval settings"}
          </button>
          {savedAt && !error && (
            <div className="memory-text" style={{ marginTop: 8 }}>Saved.</div>
          )}
        </>
      )}
    </form>
  );
}

interface SkillRow {
  name: string;
  category: string;
  description: string;
  source: "hub" | "builtin" | "local";
  trust: string;
  enabled: boolean;
}

// R16-A5: Skills tab. Wraps /api/integrations/skills (GET list, POST
// install, PATCH enable/disable). GET only returns already-installed skills
// (`hermes skills list --json`) — hub browse/search isn't wired to any API
// route yet, so "install" here is identifier-entry only, not a browsable
// catalog. ponytail: no category/name/force install overrides in the form,
// add inputs for those if users need them.
function SkillsMarketplacePanel() {
  const [skills, setSkills] = useState<SkillRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [togglingName, setTogglingName] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState<string | null>(null);

  const loadSkills = async () => {
    try {
      const res = await fetch("/api/integrations/skills");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to load");
      setSkills(json.skills ?? []);
      setListError(null);
    } catch (e) {
      setListError((e as Error).message);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const toggleSkill = async (name: string, enabled: boolean) => {
    setTogglingName(name);
    setToggleError(null);
    setSkills((cur) => cur?.map((s) => (s.name === name ? { ...s, enabled } : s)) ?? cur);
    try {
      const res = await fetch("/api/integrations/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to update");
    } catch (e) {
      setSkills((cur) => cur?.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s)) ?? cur);
      setToggleError((e as Error).message);
    } finally {
      setTogglingName(null);
    }
  };

  const installSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setInstalling(true);
    setInstallMessage(null);
    try {
      const res = await fetch("/api/integrations/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Install failed");
      setIdentifier("");
      setInstallMessage("Installed.");
      await loadSkills();
    } catch (e) {
      setInstallMessage((e as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      <div className="panel-section-title" style={{ marginTop: 0 }}>Installed skills</div>
      {listError && (
        <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>
          Failed to load: {listError}
        </div>
      )}
      {skills === null && !listError && <PanelLoading />}
      {skills !== null && skills.length === 0 && !listError && (
        <PanelEmpty icon={<Puzzle className="w-5 h-5" />}>No skills installed yet.</PanelEmpty>
      )}
      {toggleError && (
        <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>{toggleError}</div>
      )}

      {skills?.map((s) => (
        <div key={s.name} className="mcp-server-item" style={{ opacity: s.enabled ? 1 : 0.65 }}>
          <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
            <Puzzle className="w-3.5 h-3.5" />
          </div>
          <div className="mcp-server-info">
            <div className="mcp-server-name">{s.name}</div>
            <div className="mcp-server-url">{s.description || "No description"}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <span style={skillBadgeStyle}>{s.category}</span>
              <span style={s.trust === "community" ? skillBadgeStyle : skillBadgeTrustedStyle}>{s.trust}</span>
              <span style={skillBadgeStyle}>{s.source}</span>
            </div>
          </div>
          <div className={`mcp-server-status ${s.enabled ? "connected" : "disconnected"}`} />
          <button
            type="button"
            className="mcp-add-btn"
            style={{ width: "auto", flexShrink: 0, padding: "4px 8px", fontSize: 12 }}
            disabled={togglingName === s.name}
            onClick={() => toggleSkill(s.name, !s.enabled)}
          >
            {togglingName === s.name ? "…" : s.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      ))}

      <div className="panel-section-title" style={{ marginTop: 20 }}>Install a skill</div>
      <div className="setting-desc" style={{ marginBottom: 12 }}>
        Enter a skill identifier from the hub (e.g. openai/skills/skill-creator) or a direct SKILL.md URL.
      </div>
      <form onSubmit={installSkill} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Skill identifier or SKILL.md URL"
          className="message-input"
          style={{ height: 32 }}
        />
        <button type="submit" className="mcp-add-btn" disabled={installing || !identifier.trim()}>
          {installing ? "Installing…" : "Install skill"}
        </button>
        {installMessage && <div className="memory-text">{installMessage}</div>}
      </form>
    </>
  );
}

interface McpServerRow {
  name: string;
  transport: string;
  enabled: boolean;
}

const N8N_DEFAULT_BASE_URL = "http://127.0.0.1:5678";

// R16-A6: one-click Linear/n8n connect. Reuses A1's generic
// /api/integrations/mcp (GET/POST/PATCH/DELETE) as-is — no new API route.
//
// Linear (auth.type: oauth, no provider) does NOT get an honest "Connected"
// state here on purpose. Verified: `hermes mcp install linear` succeeds
// (writes the config entry, no crash) because
// tools/mcp_oauth_manager.py's `MCPOAuthManager._build_provider` only
// *raises* `OAuthNonInteractiveError` when the caller is non-interactive
// with no cached tokens — it never opens a browser. Aio's `runHermesMcp`
// (lib/hermes/mcp-cli.ts) always spawns non-interactively (closed stdin),
// and that same guard fires again at the *next* MCP connect too (live
// session tool-load, `tools/mcp_tool.py:1974-1982`), which also runs
// server-side, headless — same class of gap as A2's `APIServerAdapter`
// finding. Even if that guard didn't fire, the OAuth redirect callback
// listens on `127.0.0.1:<port>` on whichever machine runs the Hermes
// process (`tools/mcp_oauth.py:_wait_for_callback`) — the server, not the
// connecting user's browser — so the redirect could never reach it anyway.
// So: the button is real (it does install), the status is honest (never
// claims connected), the message is a placeholder pending Product/UX
// copy sign-off. See docs/roadmap/R16_EXECUTION_CHECKLIST.md A6.
function McpConnectionsPanel() {
  const [servers, setServers] = useState<McpServerRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [togglingName, setTogglingName] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [confirmRemoveName, setConfirmRemoveName] = useState<string | null>(null);

  const [linearBusy, setLinearBusy] = useState(false);
  const [linearMessage, setLinearMessage] = useState<string | null>(null);

  const [n8nBaseUrl, setN8nBaseUrl] = useState(N8N_DEFAULT_BASE_URL);
  const [n8nApiKey, setN8nApiKey] = useState("");
  const [n8nBusy, setN8nBusy] = useState(false);
  const [n8nError, setN8nError] = useState<string | null>(null);
  const [n8nMessage, setN8nMessage] = useState<string | null>(null);

  const loadServers = async () => {
    try {
      const res = await fetch("/api/integrations/mcp");
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to load");
      setServers(json.servers ?? []);
      setListError(null);
    } catch (e) {
      setListError((e as Error).message);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const toggleServer = async (name: string, enabled: boolean) => {
    setTogglingName(name);
    setToggleError(null);
    setServers((cur) => cur?.map((s) => (s.name === name ? { ...s, enabled } : s)) ?? cur);
    try {
      const res = await fetch("/api/integrations/mcp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to update");
    } catch (e) {
      setServers((cur) => cur?.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s)) ?? cur);
      setToggleError((e as Error).message);
    } finally {
      setTogglingName(null);
    }
  };

  const removeServer = async (name: string) => {
    if (confirmRemoveName !== name) {
      setConfirmRemoveName(name);
      return;
    }
    setConfirmRemoveName(null);
    setTogglingName(name);
    setToggleError(null);
    try {
      const res = await fetch("/api/integrations/mcp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to remove");
      await loadServers();
    } catch (e) {
      setToggleError((e as Error).message);
    } finally {
      setTogglingName(null);
    }
  };

  const connectLinear = async () => {
    setLinearBusy(true);
    setLinearMessage(null);
    try {
      const res = await fetch("/api/integrations/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "linear" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Connect failed");
      // ponytail: placeholder copy — Product/UX owns final consumer wording.
      setLinearMessage(
        "Added, but sign-in can't finish automatically from here yet — Linear needs a one-time setup step Aio can't complete on its own today.",
      );
      await loadServers();
    } catch (e) {
      setLinearMessage((e as Error).message);
    } finally {
      setLinearBusy(false);
    }
  };

  const connectN8n = async (e: React.FormEvent) => {
    e.preventDefault();
    setN8nError(null);
    setN8nMessage(null);
    if (!/^https?:\/\/\S+/i.test(n8nBaseUrl.trim())) {
      setN8nError("Enter a valid n8n URL (starting with http:// or https://).");
      return;
    }
    if (!n8nApiKey.trim()) {
      setN8nError("API key is required.");
      return;
    }
    setN8nBusy(true);
    try {
      const res = await fetch("/api/integrations/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "n8n",
          env: { N8N_BASE_URL: n8nBaseUrl.trim(), N8N_API_KEY: n8nApiKey.trim() },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Connect failed");
      setN8nApiKey("");
      setN8nMessage("Connected.");
      await loadServers();
    } catch (e) {
      setN8nError((e as Error).message);
    } finally {
      setN8nBusy(false);
    }
  };

  const renderControls = (name: string, enabled: boolean) => (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button
        type="button"
        className="mcp-add-btn"
        style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
        disabled={togglingName === name}
        onClick={() => toggleServer(name, !enabled)}
      >
        {togglingName === name ? "…" : enabled ? "Disable" : "Enable"}
      </button>
      <button
        type="button"
        className="mcp-add-btn"
        style={
          confirmRemoveName === name
            ? { ...destructiveFilledStyle, padding: "4px 8px", fontSize: 12 }
            : { width: "auto", padding: "4px 8px", fontSize: 12 }
        }
        disabled={togglingName === name}
        onClick={() => removeServer(name)}
      >
        {confirmRemoveName === name ? "Confirm?" : "Remove"}
      </button>
    </div>
  );

  const linearRow = servers?.find((s) => s.name === "linear");
  const n8nRow = servers?.find((s) => s.name === "n8n");

  return (
    <>
      <div className="panel-section-title" style={{ marginTop: 20 }}>Automation tools</div>
      {listError && (
        <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>
          Failed to load: {listError}
        </div>
      )}
      {servers === null && !listError && <PanelLoading />}
      {toggleError && (
        <div className="memory-text" style={{ color: "var(--accent-red)", marginBottom: 8 }}>{toggleError}</div>
      )}

      <div className="mcp-server-item">
        <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
          <Server className="w-3.5 h-3.5" />
        </div>
        <div className="mcp-server-info">
          <div className="mcp-server-name">Linear</div>
          <div className="mcp-server-url">
            {linearRow ? "Added — sign-in still needed" : "Find, create, and update Linear issues"}
          </div>
        </div>
        <div className="mcp-server-status disconnected" />
        {linearRow ? (
          renderControls("linear", linearRow.enabled)
        ) : (
          <button
            type="button"
            className="mcp-add-btn"
            style={{ width: "auto", flexShrink: 0, padding: "4px 8px", fontSize: 12 }}
            disabled={linearBusy}
            onClick={connectLinear}
          >
            {linearBusy ? "Connecting…" : "Connect Linear"}
          </button>
        )}
      </div>
      {linearMessage && <div className="memory-text" style={{ marginBottom: 12 }}>{linearMessage}</div>}

      <div className="mcp-server-item">
        <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
          <Server className="w-3.5 h-3.5" />
        </div>
        <div className="mcp-server-info">
          <div className="mcp-server-name">n8n</div>
          <div className="mcp-server-url">
            {n8nRow ? "Connected" : "Manage and inspect n8n workflows"}
          </div>
        </div>
        <div className={`mcp-server-status ${n8nRow?.enabled ? "connected" : "disconnected"}`} />
        {n8nRow && renderControls("n8n", n8nRow.enabled)}
      </div>
      {!n8nRow && (
        <form onSubmit={connectN8n} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={n8nBaseUrl}
            onChange={(e) => setN8nBaseUrl(e.target.value)}
            placeholder="n8n instance URL"
            className="message-input"
            style={{ height: 32 }}
          />
          <input
            type="password"
            value={n8nApiKey}
            onChange={(e) => setN8nApiKey(e.target.value)}
            placeholder="n8n API key (Settings → API in n8n)"
            className="message-input"
            style={{ height: 32 }}
          />
          <button type="submit" className="mcp-add-btn" disabled={n8nBusy}>
            {n8nBusy ? "Connecting…" : "Connect n8n"}
          </button>
          {n8nError && <div className="memory-text" style={{ color: "var(--accent-red)" }}>{n8nError}</div>}
          {n8nMessage && <div className="memory-text">{n8nMessage}</div>}
        </form>
      )}
    </>
  );
}
