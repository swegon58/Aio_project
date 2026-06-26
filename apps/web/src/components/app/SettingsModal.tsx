"use client";

import { useRef, useState } from "react";
import { CreditCard, Database, FileText, KeyRound, Lock, Palette, Plug, Server, Trash2, X } from "lucide-react";
import { ALL_GATEABLE_TOOLSETS, TIERS, type PlanTier } from "@/lib/hermes/pricing";
import { PanelEmpty, PanelLoading } from "@/components/ui/panel-state";

type Theme = "dark" | "light";
type AccentKey = "purple" | "green" | "blue" | "pink" | "orange" | "cyan" | "red";
type SettingsTab = "general" | "connections" | "credentials" | "knowledge" | "plan";

const SETTINGS_TABS = [
  { key: "general", label: "Personalization", icon: Palette },
  { key: "connections", label: "Connections", icon: Plug },
  { key: "credentials", label: "API Keys", icon: KeyRound },
  { key: "knowledge", label: "Knowledge", icon: Database },
  { key: "plan", label: "Plan", icon: CreditCard },
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

interface KnowledgeFile {
  id: string;
  filename: string;
  status: string;
  chunkCount: number;
  error: string | null;
  createdAt: string;
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
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

  knowledgeFiles: KnowledgeFile[] | null;
  knowledgeError: string | null;
  knowledgeUploading: boolean;
  onKnowledgeUploadClick: () => void;
  onKnowledgeDelete: (id: string) => void;

  currentPlanTier: string | null;
}

// Settings modal markup/CSS ported from ai_agent_webapp (Copy 2).html's
// #settingsModal, then adapted to Aio's current English product copy.
// Toggles/sliders below have no corresponding real backend setting in
// /api/chat — they remain visual-only, matching the mockup's own
// non-persisted behavior. Theme + accent swatches are wired since AppShell
// already manages theme/accent state. Connections + Credentials moved here
// from the right panel so the panel only shows agent-facing info.
export function SettingsModal({
  open,
  onClose,
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
  knowledgeFiles,
  knowledgeError,
  knowledgeUploading,
  onKnowledgeUploadClick,
  onKnowledgeDelete,
  currentPlanTier,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const confirmRemoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [upgradingTier, setUpgradingTier] = useState<PlanTier | null>(null);

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
  const [thinkingMode, setThinkingMode] = useState(true);
  const [autoTool, setAutoTool] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const [saveHistory, setSaveHistory] = useState(true);
  const [sound, setSound] = useState(false);
  const [streamSpeed, setStreamSpeed] = useState(30);
  const [temperature, setTemperature] = useState(70);
  const [maxTokens, setMaxTokens] = useState(4096);

  if (!open) return null;
  const activeTab = SETTINGS_TABS.find((item) => item.key === tab) ?? SETTINGS_TABS[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <aside className="settings-sidebar" aria-label="Settings">
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
          <div className="settings-sidebar-title">Settings</div>
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

            <div className="setting-group">
              <div className="setting-label">
                Thinking Mode
                <button
                  type="button"
                  className={`toggle-switch${thinkingMode ? " active" : ""}`}
                  aria-pressed={thinkingMode}
                  aria-label="Thinking Mode"
                  onClick={() => setThinkingMode((v) => !v)}
                />
              </div>
              <div className="setting-desc">Show the reasoning process before responding</div>
            </div>

            <div className="setting-group">
              <div className="setting-label">
                Automatic Tool Use
                <button
                  type="button"
                  className={`toggle-switch${autoTool ? " active" : ""}`}
                  aria-pressed={autoTool}
                  aria-label="Automatic Tool Use"
                  onClick={() => setAutoTool((v) => !v)}
                />
              </div>
              <div className="setting-desc">Automatically choose and run the right tool</div>
            </div>

            <div className="setting-group">
              <div className="setting-label">
                Streaming Responses
                <button
                  type="button"
                  id="streamingToggle"
                  className={`toggle-switch${streaming ? " active" : ""}`}
                  aria-pressed={streaming}
                  aria-label="Streaming Responses"
                  onClick={() => setStreaming((v) => !v)}
                />
              </div>
              <div className="setting-desc">Show responses incrementally while they are being generated</div>
            </div>

            <div className="setting-group">
              <div className="setting-label">
                Save History
                <button
                  type="button"
                  className={`toggle-switch${saveHistory ? " active" : ""}`}
                  aria-pressed={saveHistory}
                  aria-label="Save History"
                  onClick={() => setSaveHistory((v) => !v)}
                />
              </div>
              <div className="setting-desc">Keep previous conversations available</div>
            </div>

            <div className="setting-group">
              <div className="setting-label">
                Notification Sound
                <button
                  type="button"
                  id="soundToggle"
                  className={`toggle-switch${sound ? " active" : ""}`}
                  aria-pressed={sound}
                  aria-label="Notification Sound"
                  onClick={() => setSound((v) => !v)}
                />
              </div>
              <div className="setting-desc">Play a sound when a response arrives</div>
            </div>

            <div className="setting-group">
              <div className="setting-label">
                Streaming Speed
                <span className="setting-desc">{streamSpeed} ms/word</span>
              </div>
              <input
                type="range"
                className="setting-slider"
                min={10}
                max={100}
                value={streamSpeed}
                onChange={(e) => setStreamSpeed(Number(e.target.value))}
              />
            </div>

            <div className="setting-group">
              <div className="setting-label">
                Creativity
                <span className="setting-desc">{(temperature / 100).toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="setting-slider"
                min={0}
                max={100}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </div>

            <div className="setting-group">
              <div className="setting-label">
                Maximum Response Length
                <span className="setting-desc">{maxTokens} tokens</span>
              </div>
              <input
                type="range"
                className="setting-slider"
                min={256}
                max={8192}
                step={256}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
              />
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
              Add / Update Token
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
                placeholder="Paste token"
                className="message-input"
                style={{ height: 32 }}
              />
              <button
                type="submit"
                className="mcp-add-btn"
                disabled={tokenSubmitting || !tokenPlatform || !tokenValue.trim()}
              >
                {tokenSubmitting ? "Saving…" : "Save Token"}
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
              Add / Update Key
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
                {credentialSubmitting ? "Saving…" : "Save Key"}
              </button>
              {credentialMessage && <div className="memory-text">{credentialMessage}</div>}
            </form>
          </div>
        )}

        {tab === "knowledge" && (
          <div className="setting-group" style={{ borderBottom: "none" }}>
            {knowledgeError && (
              <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                Failed to load: {knowledgeError}
              </div>
            )}

            {knowledgeFiles === null && !knowledgeError && <PanelLoading />}

            {knowledgeFiles?.length === 0 && (
              <PanelEmpty icon={<FileText className="w-5 h-5" />}>
                No documents yet. Upload one for the agent to reference.
              </PanelEmpty>
            )}

            {knowledgeFiles?.map((f) => (
              <div key={f.id} className="mcp-server-item">
                <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="mcp-server-info">
                  <div className="mcp-server-name">{f.filename}</div>
                  <div className="mcp-server-url">
                    {f.status === "ready"
                      ? `${f.chunkCount} chunks`
                      : f.status === "failed"
                        ? f.error ?? "Failed"
                        : "Processing…"}
                  </div>
                </div>
                <div className={`mcp-server-status ${f.status === "ready" ? "connected" : "disconnected"}`} />
                <button
                  type="button"
                  className="mcp-add-btn"
                  style={
                    confirmRemoveId === f.id
                      ? { marginLeft: 8, padding: "4px 8px", background: "rgba(226, 92, 92, 0.12)", color: "#e25c5c" }
                      : { marginLeft: 8, padding: "4px 8px" }
                  }
                  onClick={() => requestConfirm(f.id, () => onKnowledgeDelete(f.id))}
                  aria-label={confirmRemoveId === f.id ? "Confirm delete document" : "Delete document"}
                  title={confirmRemoveId === f.id ? "Click again to delete" : "Delete document"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <div className="panel-section-title" style={{ marginTop: 16 }}>
              Add Document
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                className="mcp-add-btn"
                disabled={knowledgeUploading}
                onClick={onKnowledgeUploadClick}
              >
                {knowledgeUploading ? "Uploading…" : "Upload .txt / .md / .csv"}
              </button>
            </div>
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
          </div>
        </section>
      </div>
    </div>
  );
}

export type { AccentKey };
