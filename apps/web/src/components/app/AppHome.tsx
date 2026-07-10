"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import { DotGrid } from "@/components/app/DotGrid";
import { legacyFrontendEventsToAioRunEvents } from "@/components/app/run-timeline";
import type { ActiveFile } from "@/components/app/FilePreview";
import { brand } from "@/lib/brand.config";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import {
  fetchRunSources,
  isRunTerminal,
  isRunStoppable,
  type AioPublicResearchSource,
} from "@/lib/aio/runs/run-client";
import type {
  HermesActivityData,
  HermesApprovalData,
  HermesCreditsData,
  HermesShowcaseData,
  HermesUIMessage,
} from "@/lib/hermes/chat-types";
import { useCronJobs } from "@/components/app/app-home/hooks/useCronJobs";
import { useNotifications } from "@/components/app/app-home/hooks/useNotifications";
import { useConnections } from "@/components/app/app-home/hooks/useConnections";
import { useCredentials } from "@/components/app/app-home/hooks/useCredentials";
import { useAccountPrefs } from "@/components/app/app-home/hooks/useAccountPrefs";
import { useWorkspacePanel } from "@/components/app/app-home/hooks/useWorkspacePanel";
import { useImageGeneration } from "@/components/app/app-home/hooks/useImageGeneration";
import { usePlanFlow } from "@/components/app/app-home/hooks/usePlanFlow";
import { useConversations } from "@/components/app/app-home/hooks/useConversations";
import { useRunTimeline } from "@/components/app/app-home/hooks/useRunTimeline";
import { useChatComposer } from "@/components/app/app-home/hooks/useChatComposer";
import { AppHomeProviders } from "@/components/app/app-home/AppHomeProviders";
import { AppModals } from "@/components/app/app-home/sections/AppModals";
import { LeftSidebar } from "@/components/app/app-home/sections/LeftSidebar";
import { FloatingChrome } from "@/components/app/app-home/sections/FloatingChrome";
import { RightPanel } from "@/components/app/app-home/sections/RightPanel";
import { Composer } from "@/components/app/app-home/sections/Composer";
import { MessageList } from "@/components/app/app-home/sections/MessageList";
import { IconRail } from "@/components/app/app-home/IconRail";
import type {
  ChatRuntimeContextValue,
  WorkspaceContextValue,
  AccountDataContextValue,
} from "@/components/app/app-home/context";
import "@/app/(app)/app/mockup.css";

import type {
  WorkspaceEntry,
} from "@/components/app/app-home-types";
import {
  parsePlanQuestion,
  splitMessageSegments,
  deriveMascotState,
  ICON_RAIL_ITEMS,
  ACCENT_HEX,
  BG_HEX,
  mixHex,
  codeBlockFileName,
  reportFileBaseName,
  buildReportHtmlDocument,
} from "@/components/app/app-home-utils";
interface AppHomeProps {
  email: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
}

export function AppHome({ email, userName, userAvatarUrl }: AppHomeProps) {
  const [activity, setActivity] = useState<HermesActivityData[]>([]);
  // code_exec showcase cards (grill-log agent-capability-showcase-cards
  // Q2/Q4/Q8): one task in flight per turn (scope-locked), live updates land
  // here; `activeShowcaseTaskId` drives both the chat-chip lookup and the
  // auto-switch of the right panel to the "showcase" tab while running.
  const [showcases, setShowcases] = useState<HermesShowcaseData[]>([]);
  // Which showcase task is shown in the right panel / mobile sheet. Holds the
  // full data (not just an id) so a click on a *persisted* (reload-restored)
  // chip works without re-searching the live `showcases` array.
  const [openShowcase, setOpenShowcase] = useState<HermesShowcaseData | null>(null);
  const [mobileShowcaseOpen, setMobileShowcaseOpen] = useState(false);
  // R13.3 item 2: finished research report routed to the Workspace preview
  // tab instead of rendering inline in the chat bubble.
  const [openReport, setOpenReport] = useState<{
    query: string;
    reportText: string;
    runId: string | null;
  } | null>(null);
  const [mobileReportOpen, setMobileReportOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<
    Extract<HermesApprovalData, { kind: "request" }> | null
  >(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditUsage, setCreditUsage] = useState<HermesCreditsData | null>(null);
  const [, setIsCompressing] = useState(false);

  const { messages, sendMessage, status, setMessages, stop, error: chatError, regenerate, clearError } = useChat<HermesUIMessage>({
    onData: (dataPart) => ingestDataPart(dataPart),
  });

  // The right panel is hidden outright by CSS at <=1024px (mockup.css), so
  // setRightPanelCollapsed(false) has no visual effect there — track the
  // breakpoint in React state and route to a full-screen modal instead.
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1024px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads matchMedia, no render-time equivalent
    setIsMobileViewport(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Ref indirection to break the usePlanFlow/useConversations <-> useRunTimeline
  // circular dependency: usePlanFlow/useConversations need a stable function
  // reference eagerly, but the real primeOptimisticRun/resetRunTimeline only
  // exist once useRunTimeline runs later (it needs the real, reactive
  // activeConversationId from useConversations in its hydration effect deps).
  const primeOptimisticRunRef = useRef<() => void>(() => {});
  const resetRunTimelineRef = useRef<() => void>(() => {});

  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<FileUIPart[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [iconRailMobileOpen, setIconRailMobileOpen] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  // Free drag-resize (R11.3): null = use the CSS preset width for the
  // current mode; set once the user drags the handle.
  const [rightPanelWidth, setRightPanelWidth] = useState<number | null>(null);
  const handleRightPanelResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const panelEl = (e.currentTarget as HTMLElement).parentElement;
    const startWidth = panelEl?.getBoundingClientRect().width ?? 420;
    const startX = e.clientX;
    // ponytail: .right-panel has a blanket `transition: all` (for its
    // collapse/expand animation), which otherwise eases the inline width
    // during drag instead of tracking the pointer 1:1. Suspend it only
    // for the drag's duration.
    if (panelEl) panelEl.style.transition = "none";
    const onMove = (ev: PointerEvent) => {
      const next = startWidth + (startX - ev.clientX);
      setRightPanelWidth(Math.min(Math.max(next, 320), window.innerWidth * 0.8));
    };
    const onUp = () => {
      if (panelEl) panelEl.style.transition = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const {
    filesSubTab,
    setFilesSubTab,
    metaLog,
    logMeta,
    terminalOpen,
    setTerminalOpen,
    terminalScale,
    setTerminalScale,
    terminalTab,
    setTerminalTab,
    cycleTerminal,
    memorySnapshot,
    galleryImages,
    setGalleryImages,
    galleryError,
    galleryUploading,
    lightboxImage,
    setLightboxImage,
    galleryFileInputRef,
    fileTreePath,
    fileTreeEntries,
    setFileTreeEntries,
    fileTreeError,
    fileTreeLoading,
    loadFileTree,
    handleGalleryFileSelected,
    handleGalleryDelete,
  } = useWorkspacePanel({ chatStatus: status, confirmDeleteId, setConfirmDeleteId, confirmDeleteTimeoutRef });
  const {
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    notificationsUnread,
    notificationsError,
    handleNotificationRead,
    handleMarkAllNotificationsRead,
  } = useNotifications();

  const {
    cronJobs,
    cronError,
    cronLocked,
    cronActionPending,
    cronName,
    setCronName,
    cronSchedule,
    setCronSchedule,
    cronPrompt,
    setCronPrompt,
    cronNotifyDiscord,
    setCronNotifyDiscord,
    cronCreating,
    cronCreateMessage,
    handleCronAction,
    handleCronDelete,
    handleCronCreate,
  } = useCronJobs({ confirmDeleteId, setConfirmDeleteId, confirmDeleteTimeoutRef });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"general" | "plan" | "data" | "connections">("general");
  const [scheduledTasksOpen, setScheduledTasksOpen] = useState(false);
  const {
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
  } = useConnections({ settingsOpen, scheduledTasksOpen, setSettingsOpen, setSettingsInitialTab, logMeta });
  const {
    credentials,
    credentialsError,
    credentialId,
    setCredentialId,
    credentialValue,
    setCredentialValue,
    credentialSubmitting,
    credentialMessage,
    handleCredentialSubmit,
  } = useCredentials({ settingsOpen, logMeta });
  const {
    theme,
    setTheme,
    accent,
    setAccent,
    onboardedAt,
    setOnboardedAt,
    exportLoading,
    exportStatus,
    handleExportData,
    deleteLoading,
    deleteStatus,
    handleDeleteAccount,
  } = useAccountPrefs({ logMeta });
  const [chatsPopoverOpen, setChatsPopoverOpen] = useState(false);


  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount check, no render-time equivalent
    if (window.innerWidth <= 768) setSidebarCollapsed(true);
  }, []);

  // Initial usage-meter read — without this, balance/usedPercent stay null
  // until the user sends a first chat message (data-hermes-credits only
  // arrives mid-stream). A later data-hermes-credits event still overwrites
  // this once a run actually settles.
  useEffect(() => {
    fetch("/api/credits")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HermesCreditsData | null) => {
        if (!data) return;
        setCreditBalance(data.balance);
        setCreditUsage(data);
      })
      .catch(() => {});
  }, []);



  const [inputFocused, setInputFocused] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [inputMultiline, setInputMultiline] = useState(false);
  const [chatMode, setChatMode] = useState<AioChatMode>("auto");
  const [activeSavedAgentId, setActiveSavedAgentId] = useState<string | null>(null);
  const [lastRunMode, setLastRunMode] = useState<AioChatMode>("auto");
  const [activeResearchQuery, setActiveResearchQuery] = useState("");

  const composerMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!composerMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!composerMenuRef.current?.contains(e.target as Node)) {
        setComposerMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setComposerMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [composerMenuOpen]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const lastAssistantMessage = messages.findLast((m) => m.role === "assistant");
  const hasText = Boolean(
    lastAssistantMessage?.parts.some((p) => p.type === "text" && p.text.length > 0),
  );
  const lastAssistantText = lastAssistantMessage?.parts
    .filter((p) => p.type === "text")
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("") ?? "";

  const {
    planAwaitingAction,
    setPlanAwaitingAction,
    planOtherText,
    setPlanOtherText,
    planQuestion,
    handlePlanRun,
    handlePlanAdjust,
    handlePlanCancel,
    handlePlanAnswer,
    handlePlanSkipToPlan,
  } = usePlanFlow({
    status,
    sendMessage,
    setActivity,
    primeOptimisticRun: () => primeOptimisticRunRef.current(),
    setShowcases,
    setPendingApproval,
    setChatMode,
    setLastRunMode,
    textareaRef,
    hasText,
    lastAssistantText,
  });

  const handleChatScroll = () => {
    const el = chatAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 200);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId((current) => (current === id ? null : current)), 1500);
    });
  };

  const handleDownloadCodeBlock = (lang: string, code: string) => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = codeBlockFileName(lang);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadReportMarkdown = (query: string, reportText: string) => {
    const blob = new Blob([reportText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportFileBaseName(query)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportReportPdf = (query: string, reportText: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(buildReportHtmlDocument(query, reportText));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // R9.3: sources disclosure panel, keyed by runId so both the live message
  // and any reloaded historical research message can fetch/cache independently.
  const [openSourcesRunId, setOpenSourcesRunId] = useState<string | null>(null);
  const [sourcesByRunId, setSourcesByRunId] = useState<Record<string, AioPublicResearchSource[]>>({});
  const [sourcesLoadingRunId, setSourcesLoadingRunId] = useState<string | null>(null);
  const [sourcesErrorRunId, setSourcesErrorRunId] = useState<string | null>(null);

  const handleToggleSources = (runId: string) => {
    if (openSourcesRunId === runId) {
      setOpenSourcesRunId(null);
      return;
    }
    setOpenSourcesRunId(runId);
    if (sourcesByRunId[runId] || sourcesLoadingRunId === runId) return;
    setSourcesLoadingRunId(runId);
    setSourcesErrorRunId(null);
    fetchRunSources(runId)
      .then((sources) => {
        setSourcesByRunId((prev) => ({ ...prev, [runId]: sources }));
      })
      .catch(() => {
        setSourcesErrorRunId(runId);
      })
      .finally(() => {
        setSourcesLoadingRunId((current) => (current === runId ? null : current));
      });
  };

  const handleRailItemClick = (key: (typeof ICON_RAIL_ITEMS)[number]["key"]) => {
    if (key === "newChat") {
      setChatsPopoverOpen(true);
      return;
    }
    if (key === "settings") {
      setSettingsOpen(true);
      return;
    }
    if (key === "scheduled") {
      setScheduledTasksOpen(true);
    }
    if (key === "notifications") {
      setNotificationsOpen(true);
    }
  };

  const {
    conversations,
    conversationsError,
    activeConversationId,
    setActiveConversationId,
    renamingConversationId,
    setRenamingConversationId,
    renameValue,
    setRenameValue,
    loadConversations,
    handleNewChat,
    handleLoadConversation,
    handleDeleteConversation,
    handleStartRename,
    handleRenameConversation,
  } = useConversations({
    status,
    setMessages,
    setActivity,
    resetRunTimeline: () => resetRunTimelineRef.current(),
    setShowcases,
    setOpenShowcase,
    setMobileShowcaseOpen,
    setOpenReport,
    setMobileReportOpen,
    setPendingApproval,
    setPlanAwaitingAction,
    setChatMode,
    setLastRunMode,
    setActiveResearchQuery,
    logMeta,
    confirmDeleteId,
    setConfirmDeleteId,
    confirmDeleteTimeoutRef,
    setSidebarCollapsed,
  });

  const {
    activeRunId,
    runEvents,
    persistedRunStatus,
    timelineHydrating,
    timelineSyncError,
    runStopPending,
    runStopError,
    resetRunTimeline,
    primeOptimisticRun,
    ingestDataPart,
    handleDurableRunStop,
  } = useRunTimeline({
    chatStatus: status,
    stop,
    activeConversationId,
    setActiveConversationId,
    isMobileViewport,
    setRightPanelCollapsed,
    setActivity,
    setShowcases,
    setOpenShowcase,
    setPendingApproval,
    setCreditBalance,
    setCreditUsage,
    setIsCompressing,
  });
  // Keep the indirection refs fresh after every render (not during render —
  // ref writes there trip the react-hooks lint rule); safe because any real
  // invocation only happens from a later event handler, well after this
  // effect has flushed.
  useEffect(() => {
    primeOptimisticRunRef.current = primeOptimisticRun;
    resetRunTimelineRef.current = resetRunTimeline;
  });

  const {
    imageComposerActive,
    setImageComposerActive,
    imageAspectRatio,
    setImageAspectRatio,
    imageResolution,
    setImageResolution,
    imageReference,
    setImageReference,
    imageGenerationStatus,
    imageGenerationError,
    setImageGenerationError,
    imageLastPrompt,
    activateImageComposer,
    handleGeneratedImageOpen,
    handleGeneratedImageEdit,
    handleGeneratedImageVariation,
    cancelImageGeneration,
    submitImageGeneration,
  } = useImageGeneration({
    messages,
    setMessages,
    setInput,
    setComposerMenuOpen,
    textareaRef,
    messagesEndRef,
    setLightboxImage,
    setGalleryImages,
    logMeta,
    setActiveConversationId,
    loadConversations,
    setActivity,
    resetRunTimeline,
    setPlanAwaitingAction,
  });

  const { addAttachments, handleSubmit, handleKeyDown, handleInput, focusComposer, handleResearchStopAndEdit } =
    useChatComposer({
      status,
      stop,
      sendMessage,
      input,
      setInput,
      pendingAttachments,
      setPendingAttachments,
      setAttachmentError,
      setInputMultiline,
      chatMode,
      setChatMode,
      activeSavedAgentId,
      setLastRunMode,
      setActiveResearchQuery,
      imageGenerationStatus,
      imageComposerActive,
      submitImageGeneration,
      setActivity,
      primeOptimisticRunRef,
      setShowcases,
      setPendingApproval,
      setPlanAwaitingAction,
      textareaRef,
      messagesEndRef,
    });

  const handleApprovalRespond = async (requestId: string, targetRunId: string, choice: "session" | "deny") => {
    try {
      const res = await fetch("/api/chat/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: targetRunId, choice }),
      });
      if (res.ok) {
        setPendingApproval((prev) => (prev?.requestId === requestId ? null : prev));
      }
    } catch {
      // Network failure — leave the card open so the user can retry.
    }
  };

  // Timeline approval resolve: called from ApprovalCard inside RunTimeline.
  // Maps "approve"→"session" and "reject"→"deny" for the Hermes gateway, then
  // clears the floating input-area approval card if it matches by runId.
  const handleTimelineApprovalResolve = async (approvalId: string, runId: string, choice: "approve" | "reject") => {
    const hermesChoice = choice === "approve" ? "session" : "deny";
    const res = await fetch("/api/chat/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, choice: hermesChoice }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { message?: string }).message ?? `Request failed: ${res.status}`);
    }
    setPendingApproval((prev) =>
      prev && (prev.requestId === approvalId || prev.runId === runId) ? null : prev,
    );
  };

  const mascotState = deriveMascotState(status, activity, hasText);
  const isStreaming = status === "submitted" || status === "streaming";

  // A3 — safety net: clear the badge once a run finishes even if a
  // compression.done event was dropped (network hiccup, stream cut short).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- safety-net clear on status change, no render-time equivalent
    if (status === "ready" || status === "error") setIsCompressing(false);
  }, [status]);

  const runningTool = activity.findLast((a): a is Extract<HermesActivityData, { kind: "tool" }> =>
    a.kind === "tool" && a.status === "running",
  );
  const lastCompletedTool = activity.findLast(
    (a): a is Extract<HermesActivityData, { kind: "tool" }> => a.kind === "tool",
  );
  // ponytail: R11 #8 Task Delegation — there's no dedicated
  // "delegation.started" event/field in the run-event stream (checked
  // aio-run-events.ts), only the same generic tool.started shape every tool
  // uses. This substring match on the raw tool name is a best-effort reuse of
  // the manifest's "delegation" canonicalName (same heuristic style already
  // used by normalizeHermesRiskLevel in hermes-event-mapper.ts), not a
  // confirmed backend contract. Upgrade path: once Hermes emits a distinct
  // delegation event carrying the sub-agent name, key off that field instead.
  const isDelegating = Boolean(runningTool && /delegat/i.test(runningTool.tool ?? ""));
  const liveStatusText = runningTool
    ? isDelegating
      ? `${brand.name} is delegating to a sub-agent: ${runningTool.label ?? "working on a subtask"}…`
      : `${brand.name} is using ${runningTool.label ?? runningTool.tool}…`
    : isStreaming
      ? `${brand.name} is thinking…`
      : timelineHydrating
        ? `${brand.name} is restoring the latest run…`
        : persistedRunStatus && !isRunTerminal(persistedRunStatus)
          ? `${brand.name} is reconnecting to the current run…`
      : lastCompletedTool
        ? `${brand.name} last ran ${lastCompletedTool.label ?? lastCompletedTool.tool}`
        : `${brand.name} is ready`;
  // Shimmer runs while Aio is actively processing (any "busy" branch above),
  // not on the static "ready"/"last ran X" idle states.
  const liveStatusIsProcessing = Boolean(runningTool) || isStreaming || timelineHydrating
    || Boolean(persistedRunStatus && !isRunTerminal(persistedRunStatus));
  const recentActivityCount = activity.length + metaLog.length;
  const hasReviewableContext =
    recentActivityCount > 0
    || (memorySnapshot?.facts?.length ?? 0) > 0
    || Boolean(memorySnapshot?.summary);
  const timelineEvents = useMemo(
    () =>
      runEvents.length > 0
        ? runEvents
        : legacyFrontendEventsToAioRunEvents({
            activity,
            approvals: pendingApproval ? [pendingApproval] : [],
            showcases,
            runId: activeRunId ?? activeConversationId ?? "current-run",
          }),
    [activity, activeConversationId, activeRunId, pendingApproval, runEvents, showcases],
  );
  const username = userName?.trim() || email.split("@")[0];
  const userInitial = username.charAt(0).toUpperCase();
  const greetingLines = useMemo(
    () => [
      `Hello, ${username}! 👋`,
      "What can I do for you?",
      "Ready when you are.",
      "Let's get something done.",
    ],
    [username],
  );

  const usedPercentLabel =
    creditUsage?.usedPercent !== undefined ? `${Math.round(creditUsage.usedPercent)}%` : null;
  const resetDateLabel = creditUsage?.resetAt
    ? new Date(creditUsage.resetAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  const usagePercentValue = creditUsage?.usedPercent ?? 0;
  const usageLevel =
    usagePercentValue >= 95 ? "critical" : usagePercentValue >= 80 ? "warning" : "normal";

  // Workspace panel: one accordion entry per assistant message that contains
  // code. The live entry auto-expands while streaming and auto-collapses
  // once the turn finishes, making room for the next live entry.
  const workspaceEntries = useMemo<WorkspaceEntry[]>(() => {
    const entries: WorkspaceEntry[] = [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const text = message.parts
        .filter((p) => p.type === "text")
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
      if (parsePlanQuestion(text)) continue;
      const blocks = splitMessageSegments(text).filter(
        (seg): seg is { type: "code"; lang: string; code: string } => seg.type === "code",
      );
      if (blocks.length === 0) continue;
      entries.push({ id: message.id, blocks: blocks.map((b) => ({ lang: b.lang, code: b.code })) });
    }
    return entries;
  }, [messages]);

  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null);
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if ((status === "streaming" || status === "submitted") && lastAssistantMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derives from prevStatusRef, no render-time equivalent
      setExpandedWorkspaceId(lastAssistantMessage.id);
    } else if (status === "ready" && prevStatusRef.current !== "ready") {
      setExpandedWorkspaceId(null);
    }
    prevStatusRef.current = status;
  }, [status, lastAssistantMessage]);

  // Aio Terminal Preview tab auto-follows whichever file the agent is
  // currently touching: prefer the most recent running tool call that
  // carries a filePath, falling back to the most recent completed one so
  // the preview doesn't go blank the instant a tool finishes.
  const activeFile = useMemo<ActiveFile | null>(() => {
    const withFile = activity.filter(
      (item): item is Extract<HermesActivityData, { kind: "tool" }> & { filePath: string } =>
        item.kind === "tool" && typeof item.filePath === "string",
    );
    if (withFile.length === 0) return null;
    const reversed = [...withFile].reverse();
    const target = reversed.find((item) => item.status === "running") ?? reversed[0];
    return { filePath: target.filePath, fileName: target.fileName };
  }, [activity]);

  // Results tab fallback when no tool-touched file is active: render the
  // most recent code block the agent produced inline in chat (the common
  // case — "Aio code xong" with no file-tool activity at all).
  const latestCodeBlock = useMemo(() => {
    for (let i = workspaceEntries.length - 1; i >= 0; i--) {
      const blocks = workspaceEntries[i].blocks;
      if (blocks.length > 0) return blocks[blocks.length - 1];
    }
    return null;
  }, [workspaceEntries]);

  const openWorkspaceEntry = (messageId: string) => {
    setExpandedWorkspaceId(messageId);
    if (!isMobileViewport) setRightPanelCollapsed(false);
  };

  // Q8: chip is only clickable once finished, so this never opens a
  // still-running/empty panel. Mirrors openWorkspaceEntry's
  // mobile-modal-vs-right-panel split (Q5).
  const openShowcasePanel = (showcase: HermesShowcaseData) => {
    setOpenShowcase(showcase);
    if (isMobileViewport) setMobileShowcaseOpen(true);
    else setRightPanelCollapsed(false);
  };

  // R13.3 item 2: mirrors openShowcasePanel, but opens the Workspace
  // terminal's "preview" tab (instead of the default panel view) since the
  // report reuses that tab's container.
  const openReportPanel = (query: string, reportText: string, runId: string | null) => {
    setOpenReport({ query, reportText, runId });
    if (isMobileViewport) {
      setMobileReportOpen(true);
      return;
    }
    setTerminalOpen(true);
    setTerminalTab("preview");
    setRightPanelCollapsed(false);
  };

  const mobileWorkspaceEntry = isMobileViewport
    ? workspaceEntries.find((entry) => entry.id === expandedWorkspaceId) ?? null
    : null;
  const mobileWorkspaceIsLive = isStreaming && mobileWorkspaceEntry?.id === lastAssistantMessage?.id;

  // The compact icon rail is a fixed nav, never meant to scroll — but its
  // items are wider than the rail (full label width, revealed on hover), so
  // if focus/scroll-into-view ever nudges scrollLeft off 0 the rail visibly
  // shifts and clips its own icons. Pin it back to 0 whenever that happens.
  const iconRailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const rail = iconRailRef.current;
    if (!rail) return;
    const resetScroll = () => {
      if (rail.scrollLeft !== 0) rail.scrollLeft = 0;
    };
    rail.addEventListener("scroll", resetScroll);
    return () => rail.removeEventListener("scroll", resetScroll);
  }, []);

  const workspaceModalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileWorkspaceEntry) return;
    const modal = workspaceModalRef.current;
    const closeBtn = modal?.querySelector<HTMLElement>(".workspace-mobile-modal-close");
    closeBtn?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedWorkspaceId(null);
        return;
      }
      if (e.key !== "Tab" || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileWorkspaceEntry]);

  // The chat transport throws the raw response body as the error message
  // (see ai-sdk's DefaultChatTransport), so a 402 insufficient_credits
  // rejection arrives here as a JSON string rather than plain text.
  let insufficientCreditsError: { message?: string } | null = null;
  if (chatError) {
    try {
      const parsed = JSON.parse(chatError.message);
      if (parsed && parsed.error === "insufficient_credits") insufficientCreditsError = parsed;
    } catch {
      // not a JSON payload, treat as a regular chat error below
    }
  }

  // Step 2 of the AppHome decomposition: package already-extracted hook
  // returns into the 3 cadence-based contexts. JSX below still reads the
  // local destructured vars directly — this wrapping is a pure addition,
  // not yet consumed — so section extraction (step 3) can switch to
  // useChatRuntime()/useWorkspace()/useAccountData() without a behavior change.
  const chatRuntimeValue: ChatRuntimeContextValue = {
    messages,
    sendMessage,
    status,
    setMessages,
    stop,
    chatError,
    regenerate,
    clearError,
    addAttachments,
    handleSubmit,
    handleKeyDown,
    handleInput,
    focusComposer,
    handleResearchStopAndEdit,
    activeRunId,
    runEvents,
    persistedRunStatus,
    timelineHydrating,
    timelineSyncError,
    runStopPending,
    runStopError,
    resetRunTimeline,
    primeOptimisticRun,
    ingestDataPart,
    handleDurableRunStop,
    planAwaitingAction,
    setPlanAwaitingAction,
    planOtherText,
    setPlanOtherText,
    planQuestion,
    handlePlanRun,
    handlePlanAdjust,
    handlePlanCancel,
    handlePlanAnswer,
    handlePlanSkipToPlan,
  };

  const workspaceValue: WorkspaceContextValue = {
    filesSubTab,
    setFilesSubTab,
    metaLog,
    logMeta,
    terminalOpen,
    terminalScale,
    setTerminalScale,
    terminalTab,
    setTerminalTab,
    cycleTerminal,
    memorySnapshot,
    galleryImages,
    setGalleryImages,
    galleryError,
    galleryUploading,
    lightboxImage,
    setLightboxImage,
    galleryFileInputRef,
    fileTreePath,
    fileTreeEntries,
    setFileTreeEntries,
    fileTreeError,
    fileTreeLoading,
    loadFileTree,
    handleGalleryFileSelected,
    handleGalleryDelete,
    imageComposerActive,
    setImageComposerActive,
    imageAspectRatio,
    setImageAspectRatio,
    imageResolution,
    setImageResolution,
    imageReference,
    setImageReference,
    imageGenerationStatus,
    imageGenerationError,
    setImageGenerationError,
    imageLastPrompt,
    activateImageComposer,
    handleGeneratedImageOpen,
    handleGeneratedImageEdit,
    handleGeneratedImageVariation,
    cancelImageGeneration,
    submitImageGeneration,
  };

  const accountDataValue: AccountDataContextValue = {
    conversations,
    conversationsError,
    activeConversationId,
    setActiveConversationId,
    renamingConversationId,
    setRenamingConversationId,
    renameValue,
    setRenameValue,
    loadConversations,
    handleNewChat,
    handleLoadConversation,
    handleDeleteConversation,
    handleStartRename,
    handleRenameConversation,
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
    credentials,
    credentialsError,
    credentialId,
    setCredentialId,
    credentialValue,
    setCredentialValue,
    credentialSubmitting,
    credentialMessage,
    handleCredentialSubmit,
    cronJobs,
    cronError,
    cronLocked,
    cronActionPending,
    cronName,
    setCronName,
    cronSchedule,
    setCronSchedule,
    cronPrompt,
    setCronPrompt,
    cronNotifyDiscord,
    setCronNotifyDiscord,
    cronCreating,
    cronCreateMessage,
    handleCronAction,
    handleCronDelete,
    handleCronCreate,
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    notificationsUnread,
    notificationsError,
    handleNotificationRead,
    handleMarkAllNotificationsRead,
    theme,
    setTheme,
    accent,
    setAccent,
    onboardedAt,
    setOnboardedAt,
    exportLoading,
    exportStatus,
    handleExportData,
    deleteLoading,
    deleteStatus,
    handleDeleteAccount,
  };

  return (
    <AppHomeProviders chatRuntime={chatRuntimeValue} workspace={workspaceValue} accountData={accountDataValue}>
    <div className="aio-mockup" data-theme={theme} data-accent={accent} suppressHydrationWarning>
      <div className="particles-bg" aria-hidden>
        <DotGrid
          key={theme}
          dotSize={3}
          gap={28}
          baseColor={mixHex(ACCENT_HEX[accent], BG_HEX[theme], 0.1)}
          activeColor={mixHex(ACCENT_HEX[accent], BG_HEX[theme], 0.22)}
          proximity={0}
          shockRadius={0}
          shockStrength={0}
        />
      </div>
      <div className="bottom-glow" aria-hidden />

      <FloatingChrome
        creditBalance={creditBalance}
        usageLevel={usageLevel}
        setRightPanelCollapsed={setRightPanelCollapsed}
        iconRailMobileOpen={iconRailMobileOpen}
        setIconRailMobileOpen={setIconRailMobileOpen}
        handleRailItemClick={handleRailItemClick}
        userAvatarUrl={userAvatarUrl}
        userInitial={userInitial}
        username={username}
      />

      <div className={`app-container${terminalOpen && terminalScale === "focus" ? " output-focus" : ""}`}>
        <div className="icon-rail-slot">
          <nav className="icon-rail icon-rail--compact" ref={iconRailRef}>
            <div className="icon-rail-main">
              <IconRail variant="compact" onItemClick={handleRailItemClick} notificationsUnread={notificationsUnread} />
            </div>
            <div className="icon-rail-footer">
              <div className="icon-rail-footer-avatar" title={username}>
                {userAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                ) : (
                  userInitial
                )}
              </div>
              <div className="icon-rail-footer-info">
                <div className="icon-rail-footer-name">{username}</div>
              </div>
            </div>
          </nav>
        </div>

        {/* ===== LEFT SIDEBAR ===== */}
        {/* Aio Output's focus scale force-hides the sidebar (mirrors
            sidebarCollapsed visuals) without touching sidebarCollapsed
            itself, so the user's prior sidebar state is restored when the
            output goes back to compact or closes. */}
        <LeftSidebar sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />

        {/* ===== MAIN CONTENT ===== */}
        <main className="main-content">
          <MessageList
            chatAreaRef={chatAreaRef}
            handleChatScroll={handleChatScroll}
            messages={messages}
            mascotState={mascotState}
            greetingLines={greetingLines}
            isMobileViewport={isMobileViewport}
            timelineEvents={timelineEvents}
            handleTimelineApprovalResolve={handleTimelineApprovalResolve}
            setInput={setInput}
            lastAssistantMessage={lastAssistantMessage}
            isStreaming={isStreaming}
            hasText={hasText}
            activity={activity}
            showcases={showcases}
            lastRunMode={lastRunMode}
            activeResearchQuery={activeResearchQuery}
            openWorkspaceEntry={openWorkspaceEntry}
            openShowcasePanel={openShowcasePanel}
            copiedMessageId={copiedMessageId}
            handleCopyMessage={handleCopyMessage}
            openReportPanel={openReportPanel}
            showScrollToBottom={showScrollToBottom}
            messagesEndRef={messagesEndRef}
          />

          <Composer
            pendingApproval={pendingApproval}
            handleApprovalRespond={handleApprovalRespond}
            hasText={hasText}
            insufficientCreditsError={insufficientCreditsError}
            setSettingsInitialTab={setSettingsInitialTab}
            setSettingsOpen={setSettingsOpen}
            isMobileViewport={isMobileViewport}
            input={input}
            setInput={setInput}
            pendingAttachments={pendingAttachments}
            setPendingAttachments={setPendingAttachments}
            attachmentError={attachmentError}
            attachmentInputRef={attachmentInputRef}
            inputFocused={inputFocused}
            setInputFocused={setInputFocused}
            inputMultiline={inputMultiline}
            composerMenuOpen={composerMenuOpen}
            setComposerMenuOpen={setComposerMenuOpen}
            composerMenuRef={composerMenuRef}
            chatMode={chatMode}
            setChatMode={setChatMode}
            activeSavedAgentId={activeSavedAgentId}
            setActiveSavedAgentId={setActiveSavedAgentId}
            textareaRef={textareaRef}
          />
        </main>

        {/* ===== RIGHT PANEL ===== */}
        <RightPanel
          rightPanelCollapsed={rightPanelCollapsed}
          setRightPanelCollapsed={setRightPanelCollapsed}
          rightPanelWidth={rightPanelWidth}
          handleRightPanelResizeStart={handleRightPanelResizeStart}
          liveStatusIsProcessing={liveStatusIsProcessing}
          liveStatusText={liveStatusText}
          timelineEvents={timelineEvents}
          handleTimelineApprovalResolve={handleTimelineApprovalResolve}
          usedPercentLabel={usedPercentLabel}
          usageLevel={usageLevel}
          usagePercentValue={usagePercentValue}
          resetDateLabel={resetDateLabel}
          openShowcase={openShowcase}
          workspaceEntries={workspaceEntries}
          isStreaming={isStreaming}
          lastAssistantMessage={lastAssistantMessage}
          expandedWorkspaceId={expandedWorkspaceId}
          setExpandedWorkspaceId={setExpandedWorkspaceId}
          copiedMessageId={copiedMessageId}
          handleCopyMessage={handleCopyMessage}
          handleDownloadCodeBlock={handleDownloadCodeBlock}
          activeFile={activeFile}
          latestCodeBlock={latestCodeBlock}
          mobileWorkspaceEntry={mobileWorkspaceEntry}
          mobileWorkspaceIsLive={mobileWorkspaceIsLive}
          workspaceModalRef={workspaceModalRef}
          mobileShowcaseOpen={mobileShowcaseOpen}
          setMobileShowcaseOpen={setMobileShowcaseOpen}
          openReport={openReport}
          handleDownloadReportMarkdown={handleDownloadReportMarkdown}
          handleExportReportPdf={handleExportReportPdf}
          handleToggleSources={handleToggleSources}
          openSourcesRunId={openSourcesRunId}
          sourcesByRunId={sourcesByRunId}
          sourcesLoadingRunId={sourcesLoadingRunId}
          sourcesErrorRunId={sourcesErrorRunId}
          mobileReportOpen={mobileReportOpen}
          setMobileReportOpen={setMobileReportOpen}
        />
      </div>

      <AppModals
        email={email}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        currentPlanTier={creditUsage?.planTier ?? null}
        confirmDeleteId={confirmDeleteId}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        settingsInitialTab={settingsInitialTab}
        setSettingsInitialTab={setSettingsInitialTab}
        scheduledTasksOpen={scheduledTasksOpen}
        setScheduledTasksOpen={setScheduledTasksOpen}
        chatsPopoverOpen={chatsPopoverOpen}
        setChatsPopoverOpen={setChatsPopoverOpen}
      />
    </div>
    </AppHomeProviders>
  );
}
