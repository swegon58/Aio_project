"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Eye,
  File,
  FileCode,
  Folder,
  ImageIcon,
  Link2,
  ListTree,
  Maximize2,
  Minimize2,
  Printer,
  TerminalSquare,
  X,
} from "lucide-react";
import { brand } from "@/lib/brand.config";
import { PanelEmpty, PanelLoading } from "@/components/ui/panel-state";
import { PreviewPane, ShowcaseErrorDetail, type ActiveFile } from "@/components/app/FilePreview";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";
import { RunTimeline, type AgentDisplayState } from "@/components/app/run-timeline";
import { codeBlockFileName, codeBlockSize, highlightCode } from "@/components/app/app-home-utils";
import type { FilesSubTab, TodayAction, TodayCard as TodayCardData, WorkspaceEntry } from "@/components/app/app-home-types";
import type { HermesShowcaseData, HermesUIMessage } from "@/lib/hermes/chat-types";
import type { AioRunEvent, AioRunStatus } from "@/lib/aio/runs/aio-run-events";
import type { AioPublicResearchSource } from "@/lib/aio/runs/run-client";
import { useWorkspace } from "@/components/app/app-home/context";
import { CurrentRunCard } from "@/components/app/app-home/sections/CurrentRunCard";
import { TodayCard } from "@/components/app/app-home/sections/TodayCard";

interface RightPanelProps {
  rightPanelCollapsed: boolean;
  setRightPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  rightPanelWidth: number | null;
  handleRightPanelResizeStart: (e: React.PointerEvent) => void;
  liveStatusIsProcessing: boolean;
  liveStatusText: string;
  durableRunVisible: boolean;
  currentRunBadgeState: AgentDisplayState;
  currentRunStatusLabel: string;
  currentRunNote: string;
  currentRunCanStop: boolean;
  runStopPending: boolean;
  handleDurableRunStop: () => Promise<void>;
  currentRunTone: "warning" | "working" | "approval" | "default";
  timelineHydrating: boolean;
  runStopError: string | null;
  timelineSyncError: string | null;
  persistedRunStatus: AioRunStatus | null;
  timelineEvents: AioRunEvent[];
  handleTimelineApprovalResolve: (approvalId: string, runId: string, choice: "approve" | "reject") => Promise<void>;
  usedPercentLabel: string | null;
  usageLevel: "critical" | "warning" | "normal";
  usagePercentValue: number;
  resetDateLabel: string | null;
  activeTodayCards: TodayCardData[];
  handleTodayAction: (card: TodayCardData, action: TodayAction) => void;
  openShowcase: HermesShowcaseData | null;
  workspaceEntries: WorkspaceEntry[];
  isStreaming: boolean;
  lastAssistantMessage: HermesUIMessage | undefined;
  expandedWorkspaceId: string | null;
  setExpandedWorkspaceId: Dispatch<SetStateAction<string | null>>;
  copiedMessageId: string | null;
  handleCopyMessage: (id: string, text: string) => void;
  handleDownloadCodeBlock: (lang: string, code: string) => void;
  activeFile: ActiveFile | null;
  latestCodeBlock: { lang: string; code: string } | null;
  mobileWorkspaceEntry: WorkspaceEntry | null;
  mobileWorkspaceIsLive: boolean;
  workspaceModalRef: RefObject<HTMLDivElement | null>;
  mobileShowcaseOpen: boolean;
  setMobileShowcaseOpen: Dispatch<SetStateAction<boolean>>;
  // R13.3 item 2: finished research report, routed to this panel's preview
  // tab (desktop) / a dedicated mobile modal instead of the chat bubble.
  openReport: { query: string; reportText: string; runId: string | null } | null;
  handleDownloadReportMarkdown: (query: string, reportText: string) => void;
  handleExportReportPdf: (query: string, reportText: string) => void;
  handleToggleSources: (runId: string) => void;
  openSourcesRunId: string | null;
  sourcesByRunId: Record<string, AioPublicResearchSource[]>;
  sourcesLoadingRunId: string | null;
  sourcesErrorRunId: string | null;
  mobileReportOpen: boolean;
  setMobileReportOpen: Dispatch<SetStateAction<boolean>>;
}

export function RightPanel({
  rightPanelCollapsed,
  setRightPanelCollapsed,
  rightPanelWidth,
  handleRightPanelResizeStart,
  liveStatusIsProcessing,
  liveStatusText,
  durableRunVisible,
  currentRunBadgeState,
  currentRunStatusLabel,
  currentRunNote,
  currentRunCanStop,
  runStopPending,
  handleDurableRunStop,
  currentRunTone,
  timelineHydrating,
  runStopError,
  timelineSyncError,
  persistedRunStatus,
  timelineEvents,
  handleTimelineApprovalResolve,
  usedPercentLabel,
  usageLevel,
  usagePercentValue,
  resetDateLabel,
  activeTodayCards,
  handleTodayAction,
  openShowcase,
  workspaceEntries,
  isStreaming,
  lastAssistantMessage,
  expandedWorkspaceId,
  setExpandedWorkspaceId,
  copiedMessageId,
  handleCopyMessage,
  handleDownloadCodeBlock,
  activeFile,
  latestCodeBlock,
  mobileWorkspaceEntry,
  mobileWorkspaceIsLive,
  workspaceModalRef,
  mobileShowcaseOpen,
  setMobileShowcaseOpen,
  openReport,
  handleDownloadReportMarkdown,
  handleExportReportPdf,
  handleToggleSources,
  openSourcesRunId,
  sourcesByRunId,
  sourcesLoadingRunId,
  sourcesErrorRunId,
  mobileReportOpen,
  setMobileReportOpen,
}: RightPanelProps) {
  const {
    filesSubTab,
    setFilesSubTab,
    terminalOpen,
    terminalScale,
    setTerminalScale,
    terminalTab,
    setTerminalTab,
    cycleTerminal,
    galleryImages,
    galleryError,
    galleryUploading,
    setLightboxImage,
    galleryFileInputRef,
    fileTreePath,
    fileTreeEntries,
    setFileTreeEntries,
    fileTreeError,
    fileTreeLoading,
    loadFileTree,
    handleGalleryFileSelected,
  } = useWorkspace();

  // R13.3 item 2: title + export/sources controls + full markdown report,
  // reused verbatim in the desktop preview tab and the mobile report modal.
  const renderReportBody = (report: { query: string; reportText: string; runId: string | null }) => (
    <>
      <div className="panel-section-heading">Deep research</div>
      <div className="panel-section-title">{report.query.trim() || "Deep research"}</div>
      <div className="message-meta" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="copy-btn"
          onClick={() => handleDownloadReportMarkdown(report.query, report.reportText)}
          aria-label="Download report as Markdown"
          title="Download report as Markdown"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="copy-btn"
          onClick={() => handleExportReportPdf(report.query, report.reportText)}
          aria-label="Export report as PDF"
          title="Export report as PDF"
        >
          <Printer className="w-3.5 h-3.5" />
        </button>
        {report.runId && (
          <button
            type="button"
            className="copy-btn"
            onClick={() => handleToggleSources(report.runId!)}
            aria-label="Show sources"
            title="Show sources"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <MarkdownMessage text={report.reportText} />
      {report.runId && openSourcesRunId === report.runId && (
        <div className="research-sources-panel">
          {sourcesLoadingRunId === report.runId ? (
            <p className="research-sources-status">Loading sources…</p>
          ) : sourcesErrorRunId === report.runId ? (
            <p className="research-sources-status">Couldn&apos;t load sources.</p>
          ) : (sourcesByRunId[report.runId]?.length ?? 0) === 0 ? (
            <p className="research-sources-status">No sources recorded for this run.</p>
          ) : (
            <ul className="research-sources-list">
              {sourcesByRunId[report.runId]!.map((source) => (
                <li key={source.id} className="research-source-item">
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title || source.url}
                  </a>
                  <span className="research-source-type">{source.sourceType}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      <aside
        className={`right-panel${rightPanelCollapsed ? " collapsed" : ""}${
          terminalOpen ? ` output-${terminalScale}` : ""
        }`}
        style={
          !rightPanelCollapsed && rightPanelWidth
            ? { width: rightPanelWidth, minWidth: rightPanelWidth, flex: `0 0 ${rightPanelWidth}px` }
            : undefined
        }
      >
        {!rightPanelCollapsed && (
          <div
            className="right-panel-resize-handle"
            onPointerDown={handleRightPanelResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
          />
        )}
        <div className="panel-header">
          <h3></h3>
          <div className="panel-header-actions">
            <button
              type="button"
              className="panel-action-btn"
              onClick={() => setRightPanelCollapsed(true)}
              aria-label="Collapse"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className={`panel-action-btn--terminal${terminalOpen ? " active" : ""}`}
          onClick={cycleTerminal}
          aria-label={!terminalOpen ? "Open Terminal" : "Close Terminal"}
          aria-pressed={terminalOpen}
          title={!terminalOpen ? "Open Terminal" : "Close Terminal"}
        >
          <TerminalSquare className="w-4 h-4" />
          <span>Terminal</span>
        </button>

        {!terminalOpen && (
        <div className="panel-tab-content">
        <div>
            <div className="panel-section panel-section--aio">
              <div className="agent-info-card">
                <div className="agent-info-avatar">
                  {/* logo removed */}
                </div>
                <div className="agent-info-details">
                  <h4>{brand.name}</h4>
                  <p className={liveStatusIsProcessing ? "status-line-shimmer" : undefined}>{liveStatusText}</p>
                </div>
              </div>
              {durableRunVisible && (
                <CurrentRunCard
                  currentRunBadgeState={currentRunBadgeState}
                  currentRunStatusLabel={currentRunStatusLabel}
                  currentRunNote={currentRunNote}
                  currentRunCanStop={currentRunCanStop}
                  runStopPending={runStopPending}
                  handleDurableRunStop={handleDurableRunStop}
                  currentRunTone={currentRunTone}
                  timelineHydrating={timelineHydrating}
                  runStopError={runStopError}
                  timelineSyncError={timelineSyncError}
                  persistedRunStatus={persistedRunStatus}
                  timelineEvents={timelineEvents}
                  handleTimelineApprovalResolve={handleTimelineApprovalResolve}
                />
              )}
              {usedPercentLabel && (
                <div className={`usage-meter${usageLevel !== "normal" ? ` usage-meter--${usageLevel}` : ""}`}>
                  <div className="usage-meter-bar">
                    <div
                      className="usage-meter-fill"
                      style={{ width: `${Math.min(100, usagePercentValue)}%` }}
                    />
                  </div>
                  <div className="usage-meter-label">
                    <span>{usedPercentLabel} used</span>
                    {resetDateLabel && <span>Resets {resetDateLabel}</span>}
                  </div>
                  {usageLevel === "critical" && (
                    <div className="usage-meter-warning">Almost out of credits — resets {resetDateLabel ?? "soon"}.</div>
                  )}
                </div>
              )}
            </div>

            <div className="panel-section panel-section--today">
              <div className="panel-section-heading panel-section-heading--inline">Today</div>
              <div className="today-card-grid">
                {activeTodayCards.map((card) => (
                  <TodayCard key={card.id} card={card} onAction={handleTodayAction} />
                ))}
                {activeTodayCards.length === 0 && (
                  <PanelEmpty icon={<CheckCircle2 className="w-5 h-5" />}>Today is clear.</PanelEmpty>
                )}
              </div>
            </div>

          </div>

        {openShowcase && (
          <div className="panel-section">
            <div className="panel-section-heading">Code Execution</div>
            <div className="panel-section-title">
              {openShowcase.taskData.scriptPath?.split("/").pop() ?? "script"}
            </div>
            <pre className="workspace-code-block">
              <code>{openShowcase.taskData.code ?? "No source captured."}</code>
            </pre>
            {openShowcase.status === "error" && (
              <ShowcaseErrorDetail stdout={openShowcase.taskData.stdout} />
            )}
            <div className="panel-section-title" style={{ marginTop: 14 }}>
              Results
            </div>
            {openShowcase.taskData.resultsTable && openShowcase.taskData.resultsTable.length > 0 ? (
              <table className="showcase-results-table">
                <thead>
                  <tr>
                    {Object.keys(openShowcase.taskData.resultsTable[0]).map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openShowcase.taskData.resultsTable.map((row: Record<string, string>, i: number) => (
                    <tr key={i}>
                      {Object.keys(openShowcase.taskData.resultsTable![0]).map((col) => (
                        <td key={col}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <PanelEmpty icon={<FileCode className="w-5 h-5" />}>No results table yet.</PanelEmpty>
            )}
            {openShowcase.taskData.resultsFile && (
              <a
                href={openShowcase.taskData.resultsFile}
                download
                className="message-artifact-card"
                style={{ marginTop: 8 }}
              >
                <Download className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--aio-subtle)" }} aria-hidden />
                <span className="truncate">Download results file</span>
              </a>
            )}
          </div>
        )}

        <div className="panel-section panel-section--files">
            <div className="panel-section-heading">Files</div>
            <div className="panel-tabs panel-tabs--segmented" style={{ marginBottom: 12 }}>
              {(["gallery", "files"] as FilesSubTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`panel-tab${filesSubTab === t ? " active" : ""}`}
                  onClick={() => setFilesSubTab(t)}
                >
                  {t === "gallery" ? "Gallery" : "Files"}
                </button>
              ))}
            </div>

            {filesSubTab === "gallery" && (
              <>
                <input
                  ref={galleryFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleGalleryFileSelected}
                />
                <button
                  type="button"
                  className="mcp-add-btn"
                  disabled={galleryUploading}
                  onClick={() => galleryFileInputRef.current?.click()}
                  style={{ marginBottom: 12 }}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {galleryUploading ? "Uploading…" : "Save Image to Gallery"}
                </button>

                {galleryError && (
                  <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                    Failed to load: {galleryError}
                  </div>
                )}

                {galleryImages === null && !galleryError && <PanelLoading />}

                {galleryImages?.length === 0 && (
                  <PanelEmpty icon={<ImageIcon className="w-5 h-5" />}>
                    No saved images yet. Save an image from chat to keep it here across sessions.
                  </PanelEmpty>
                )}

                {galleryImages && galleryImages.length > 0 && (
                  <div className="gallery-grid">
                    {galleryImages.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        className="gallery-thumb"
                        onClick={() => setLightboxImage(img)}
                        aria-label={img.caption ?? "Saved image"}
                      >
                        {img.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img.url} alt={img.caption ?? "Saved image"} />
                        ) : (
                          <div className="gallery-thumb-fallback">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

              </>
            )}

            {filesSubTab === "files" && (
              <>
                {fileTreePath !== "." && (
                  <button
                    type="button"
                    className="mcp-add-btn"
                    style={{ marginBottom: 8 }}
                    onClick={() => {
                      const parent = fileTreePath.split("/").slice(0, -1).join("/") || ".";
                      setFileTreeEntries(null);
                      loadFileTree(parent);
                    }}
                  >
                    ← Up
                  </button>
                )}

                <div className="memory-text" style={{ marginBottom: 8, opacity: 0.7 }}>
                  {fileTreePath}
                </div>

                {fileTreeError && fileTreeError !== "no_workspace" && (
                  <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                    Failed to load: {fileTreeError}
                  </div>
                )}

                {fileTreeLoading && fileTreeEntries === null && <PanelLoading />}

                {!fileTreeLoading && fileTreeEntries && fileTreeEntries.length === 0 && fileTreeError === "no_workspace" && (
                  <PanelEmpty icon={<Folder className="w-5 h-5" />}>
                    Send a message first to start a workspace.
                  </PanelEmpty>
                )}

                {!fileTreeLoading && fileTreeEntries && fileTreeEntries.length === 0 && !fileTreeError && (
                  <PanelEmpty icon={<Folder className="w-5 h-5" />}>Empty directory.</PanelEmpty>
                )}

                {fileTreeEntries && fileTreeEntries.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {fileTreeEntries.map((entry) => (
                      <button
                        key={entry.name}
                        type="button"
                        className="mcp-server-item"
                        disabled={entry.type !== "dir"}
                        style={entry.type !== "dir" ? { cursor: "default" } : undefined}
                        onClick={() => {
                          if (entry.type !== "dir") return;
                          const next = fileTreePath === "." ? entry.name : `${fileTreePath}/${entry.name}`;
                          setFileTreeEntries(null);
                          loadFileTree(next);
                        }}
                      >
                        <div className="mcp-server-icon" style={{ background: "var(--bg-hover)" }}>
                          {entry.type === "dir" ? (
                            <Folder className="w-3.5 h-3.5" />
                          ) : (
                            <File className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="mcp-server-info">
                          <div className="mcp-server-name">{entry.name}</div>
                          <div className="mcp-server-url">
                            {entry.type === "dir" ? "Directory" : `${entry.size ?? 0} bytes`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

        </div>
        )}

        {terminalOpen && (
          <div className={`aio-terminal aio-terminal--${terminalScale}`}>
            <div className="aio-terminal-tabs" role="tablist" aria-label="Aio Output views">
              <button
                type="button"
                className={`aio-terminal-tab${terminalTab === "activity" ? " active" : ""}`}
                onClick={() => setTerminalTab("activity")}
                role="tab"
                aria-selected={terminalTab === "activity"}
              >
                <ListTree className="w-4 h-4" />
                Activity
              </button>
              <button
                type="button"
                className={`aio-terminal-tab${terminalTab === "preview" ? " active" : ""}`}
                onClick={() => setTerminalTab("preview")}
                role="tab"
                aria-selected={terminalTab === "preview"}
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                type="button"
                className="aio-terminal-tab-expand"
                onClick={() => setTerminalScale(terminalScale === "focus" ? "compact" : "focus")}
                aria-label={terminalScale === "focus" ? "Use compact output view" : "Focus output"}
                title={terminalScale === "focus" ? "Compact view" : "Focus view"}
              >
                {terminalScale === "focus"
                  ? <Minimize2 className="w-4 h-4" />
                  : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {terminalTab === "activity" ? (
              <div className="aio-terminal-body">
                {workspaceEntries.length === 0 && timelineEvents.length === 0 ? (
                  <div className="output-empty-state">
                    <div className="output-empty-icon"><ListTree className="w-5 h-5" /></div>
                    <h4>No activity yet</h4>
                    <p>Current task activity will appear here.</p>
                  </div>
                ) : (
                  <>
                    {timelineEvents.length > 0 && <RunTimeline events={timelineEvents} compact onResolveApproval={handleTimelineApprovalResolve} />}
                    {workspaceEntries.map((entry, idx) => {
                      const isLive = isStreaming && entry.id === lastAssistantMessage?.id;
                      const isOpen = expandedWorkspaceId === entry.id;
                      return (
                        <div key={entry.id} className={`workspace-entry${isOpen ? " open" : ""}`}>
                          <button
                            type="button"
                            className="workspace-entry-header"
                            onClick={() => setExpandedWorkspaceId(isOpen ? null : entry.id)}
                          >
                            <ChevronRight className={`w-3.5 h-3.5 workspace-entry-chevron${isOpen ? " open" : ""}`} />
                            <span>{isLive ? "Live" : `Turn ${idx + 1}`}</span>
                            {isLive && <span className="workspace-entry-live-dot" aria-hidden />}
                          </button>
                          {isOpen && (
                            <div className="workspace-entry-body">
                              {entry.blocks.map((block, i) => {
                                const blockId = `${entry.id}-${i}`;
                                return (
                                  <div key={i} className="code-file-card">
                                    <div className="code-file-card-header">
                                      <FileCode className="w-4 h-4 code-file-card-icon" />
                                      <div className="code-file-card-meta">
                                        <span className="code-file-card-name">{codeBlockFileName(block.lang)}</span>
                                        <span className="code-file-card-size">{codeBlockSize(block.code)}</span>
                                      </div>
                                      <button
                                        type="button"
                                        className="code-file-card-copy"
                                        onClick={() => handleCopyMessage(blockId, block.code)}
                                      >
                                        <Copy className="w-3 h-3" />
                                        {copiedMessageId === blockId ? "Copied" : "Copy"}
                                      </button>
                                      <button
                                        type="button"
                                        className="code-file-card-download"
                                        onClick={() => handleDownloadCodeBlock(block.lang, block.code)}
                                      >
                                        <Download className="w-3 h-3" />
                                        Download
                                      </button>
                                    </div>
                                    <pre className="workspace-code-block">
                                      <code dangerouslySetInnerHTML={{ __html: highlightCode(block.code) }} />
                                    </pre>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            ) : (
              <div className="aio-terminal-body">
                {openReport ? (
                  renderReportBody(openReport)
                ) : activeFile ? (
                  <PreviewPane file={activeFile} />
                ) : latestCodeBlock && ["html", "htm"].includes(latestCodeBlock.lang.toLowerCase()) ? (
                  <iframe
                    srcDoc={latestCodeBlock.code}
                    className="terminal-results-iframe"
                    sandbox="allow-scripts"
                    title="Preview"
                  />
                ) : latestCodeBlock ? (
                  <div className="terminal-preview-pane">
                    <div className="terminal-preview-filename">{codeBlockFileName(latestCodeBlock.lang)}</div>
                    <pre className="workspace-code-block">
                      <code dangerouslySetInnerHTML={{ __html: highlightCode(latestCodeBlock.code) }} />
                    </pre>
                  </div>
                ) : (
                  <PreviewPane file={activeFile} />
                )}
              </div>
            )}
          </div>
        )}
      </aside>

      {mobileWorkspaceEntry && (
        <div
          className="workspace-mobile-modal-overlay"
          onClick={() => setExpandedWorkspaceId(null)}
        >
          <div
            className="workspace-mobile-modal"
            role="dialog"
            aria-modal="true"
            aria-label={mobileWorkspaceIsLive ? "Live" : "Workspace"}
            ref={workspaceModalRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workspace-mobile-modal-header">
              <span>{mobileWorkspaceIsLive ? "Live" : "Workspace"}</span>
              <button
                type="button"
                className="workspace-mobile-modal-close"
                onClick={() => setExpandedWorkspaceId(null)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="workspace-entry-body">
              {mobileWorkspaceIsLive && <RunTimeline events={timelineEvents} compact onResolveApproval={handleTimelineApprovalResolve} />}
              {mobileWorkspaceEntry.blocks.map((block, i) => (
                <pre key={i} className="workspace-code-block">
                  <code>{block.code}</code>
                </pre>
              ))}
            </div>
          </div>
        </div>
      )}

      {mobileShowcaseOpen && openShowcase && (
        <div
          className="workspace-mobile-modal-overlay"
          onClick={() => setMobileShowcaseOpen(false)}
        >
          <div
            className="workspace-mobile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Code Execution"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workspace-mobile-modal-header">
              <span>Code Execution</span>
              <button
                type="button"
                className="workspace-mobile-modal-close"
                onClick={() => setMobileShowcaseOpen(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="workspace-entry-body">
              <pre className="workspace-code-block">
                <code>{openShowcase.taskData.code ?? "No source captured."}</code>
              </pre>
              {openShowcase.status === "error" && (
                <ShowcaseErrorDetail stdout={openShowcase.taskData.stdout} />
              )}
              {openShowcase.taskData.resultsTable && openShowcase.taskData.resultsTable.length > 0 && (
                <table className="showcase-results-table">
                  <thead>
                    <tr>
                      {Object.keys(openShowcase.taskData.resultsTable[0]).map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openShowcase.taskData.resultsTable.map((row: Record<string, string>, i: number) => (
                      <tr key={i}>
                        {Object.keys(openShowcase.taskData.resultsTable![0]).map((col) => (
                          <td key={col}>{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {openShowcase.taskData.resultsFile && (
                <a
                  href={openShowcase.taskData.resultsFile}
                  download
                  className="message-artifact-card"
                  style={{ marginTop: 8 }}
                >
                  <Download className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--aio-subtle)" }} aria-hidden />
                  <span className="truncate">Download results file</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {mobileReportOpen && openReport && (
        <div
          className="workspace-mobile-modal-overlay"
          onClick={() => setMobileReportOpen(false)}
        >
          <div
            className="workspace-mobile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Deep research report"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workspace-mobile-modal-header">
              <span>Deep research report</span>
              <button
                type="button"
                className="workspace-mobile-modal-close"
                onClick={() => setMobileReportOpen(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="workspace-entry-body">{renderReportBody(openReport)}</div>
          </div>
        </div>
      )}
    </>
  );
}
