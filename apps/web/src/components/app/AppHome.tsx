"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { FileUIPart } from "ai";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  FileCode,
  Globe,
  HelpCircle,
  ImageIcon,
  LayoutGrid,
  Link2,
  ListChecks,
  Loader2,
  Paperclip,
  PenLine,
  Play,
  Plus,
  Printer,
  Send,
  SkipForward,
  Video,
  X,
} from "lucide-react";
import { Mascot, MascotStatusBadge } from "@/components/app/Mascot";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";
import { DotGrid } from "@/components/app/DotGrid";
import TextType from "@/components/app/TextType";
import { TASK_TEMPLATES } from "@/components/app/TemplateGallery";
import { legacyFrontendEventsToAioRunEvents } from "@/components/app/run-timeline";
import { ResearchProgressCard } from "@/components/app/ResearchProgressCard";
import { ChatModeMenu } from "@/components/app/ChatModeMenu";
import { SavedAgentMenu } from "@/components/app/SavedAgentMenu";
import {
  GeneratedImageCard,
  ImageGenerationProgress,
} from "@/components/app/GeneratedImageCard";
import { Button } from "@/components/ui/button";
import { OnboardingOverlay } from "@/components/app/OnboardingOverlay";
import { ShowcaseErrorDetail, type ActiveFile } from "@/components/app/FilePreview";
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
import { CurrentRunCard } from "@/components/app/app-home/sections/CurrentRunCard";
import { TodayCard } from "@/components/app/app-home/sections/TodayCard";
import type {
  ChatRuntimeContextValue,
  WorkspaceContextValue,
  AccountDataContextValue,
} from "@/components/app/app-home/context";
import "@/app/(app)/app/mockup.css";

import type {
  TodayAction,
  TodayCard as TodayCardData,
  ImageAspectRatio,
  ImageResolution,
  WorkspaceEntry,
} from "@/components/app/app-home-types";
import {
  parsePlanQuestion,
  splitMessageSegments,
  deriveMascotState,
  badgeStateForRunStatus,
  labelForRunStatus,
  TODAY_CARDS,
  ICON_RAIL_ITEMS,
  ACCENT_HEX,
  BG_HEX,
  IMAGE_ASPECT_RATIOS,
  IMAGE_COST_USD,
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
  const [ignoredTodayCards, setIgnoredTodayCards] = useState<Set<string>>(new Set());
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

  const handleTodayAction = (card: TodayCardData, action: TodayAction) => {
    if (action === "ignore") {
      setIgnoredTodayCards((prev) => {
        const next = new Set(prev);
        next.add(card.id);
        return next;
      });
      return;
    }

    if (action === "plan") {
      setChatMode("plan");
      setInput(card.prompt);
      focusComposer();
      return;
    }

    if (action === "schedule") {
      setChatMode("plan");
      setInput(`Set up a scheduled Aio follow-up for this: ${card.prompt}`);
      focusComposer();
      return;
    }

    if (status !== "ready") {
      setInput(card.prompt);
      focusComposer();
      return;
    }

    setActivity([]);
    primeOptimisticRunRef.current();
    setShowcases([]);
    setPendingApproval(null);
    setPlanAwaitingAction(false);
    setLastRunMode("auto");
    sendMessage({ text: card.prompt }, { body: { mode: "auto" } });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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
  const durableRunVisible =
    timelineHydrating
    || Boolean(activeRunId)
    || Boolean(persistedRunStatus)
    || timelineEvents.length > 0;
  const currentRunStatusLabel = labelForRunStatus(persistedRunStatus);
  const currentRunBadgeState = badgeStateForRunStatus(persistedRunStatus, {
    hydrating: timelineHydrating,
    syncError: Boolean(timelineSyncError),
  });
  const currentRunNote = timelineHydrating
    ? "Restoring the latest saved run after reload."
    : runStopPending
      ? "Sending a durable stop request to the current run."
      : runStopError
        ? runStopError
        : timelineSyncError
          ? timelineSyncError
          : persistedRunStatus === "cancelling"
            ? "Stop requested. Waiting for the worker to confirm cancellation."
            : persistedRunStatus === "waiting_approval"
              ? "This run is paused until you respond to the approval request."
              : persistedRunStatus && !isRunTerminal(persistedRunStatus)
                ? "This view stays in sync with the persisted run history."
                : timelineEvents.length > 0
                  ? "Latest saved activity is ready to review."
                  : "Start a task to create a durable run.";
  const currentRunTone = runStopError || timelineSyncError
    ? "warning"
    : timelineHydrating || runStopPending
      ? "working"
      : persistedRunStatus === "waiting_approval"
        ? "approval"
        : "default";
  const currentRunCanStop =
    Boolean(activeRunId)
    && Boolean(persistedRunStatus)
    && persistedRunStatus !== null
    && isRunStoppable(persistedRunStatus)
    && !runStopPending;
  // Each card is a suggested action, not a status report — only surface it
  // when there's real context behind it, per card kind. No fabricated
  // defaults when the workspace is actually empty.
  const hasActiveThread = messages.length > 0;
  const activeTodayCards = TODAY_CARDS.filter((card) => {
    if (ignoredTodayCards.has(card.id)) return false;
    if (card.kind === "continue" || card.kind === "schedule") return hasActiveThread;
    return hasReviewableContext;
  });
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
              {ICON_RAIL_ITEMS.map(({ key, label, icon: Icon, active, disabled }) => (
                <button
                  key={key}
                  type="button"
                  className={`icon-rail-item icon-rail-item--compact${active ? " active" : ""}`}
                  disabled={disabled}
                  onClick={() => handleRailItemClick(key)}
                  aria-label={disabled ? `${label} (coming soon)` : label}
                  title={disabled ? "Coming soon" : undefined}
                >
                  <Icon className="w-6 h-6" />
                  {key === "notifications" && notificationsUnread > 0 && (
                    <span className="icon-rail-badge">
                      {notificationsUnread > 9 ? "9+" : notificationsUnread}
                    </span>
                  )}
                  <span className="icon-rail-label icon-rail-label-inner">{label}{disabled ? " (coming soon)" : ""}</span>
                </button>
              ))}
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
          <div className="chat-area" ref={chatAreaRef} onScroll={handleChatScroll}>
            {onboardedAt === null && messages.length === 0 && (
              <OnboardingOverlay onDismiss={() => setOnboardedAt(new Date().toISOString())} />
            )}
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <div className="mascot-container">
                  <Mascot state={mascotState} />
                </div>
                <TextType
                  as="h2"
                  className="welcome-title"
                  text={greetingLines}
                  typingSpeed={55}
                  pauseDuration={2200}
                  deletingSpeed={25}
                  loop
                  showCursor
                  cursorCharacter="|"
                />
                {isMobileViewport && (activeTodayCards.length > 0 || durableRunVisible) && (
                  <section className="mobile-today-panel" aria-label="Today">
                    <div className="mobile-today-heading">Today</div>
                    {durableRunVisible && (
                      <CurrentRunCard
                        className="current-run-card--mobile"
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
                    {activeTodayCards.length > 0 && (
                      <div className="mobile-today-strip">
                        {activeTodayCards.map((card) => (
                          <TodayCard key={card.id} card={card} onAction={handleTodayAction} />
                        ))}
                      </div>
                    )}
                  </section>
                )}
                <div className="quick-actions">
                  {TASK_TEMPLATES.slice(0, 4).map((template) => {
                    const Icon = template.icon;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        className="quick-action"
                        onClick={() => setInput(template.prompt)}
                      >
                        <span
                          className="quick-action-icon"
                          style={{ background: "var(--accent-glow)", color: "var(--accent-secondary)" }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="quick-action-text">
                          <h3>{template.title}</h3>
                          <p>{template.description}</p>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, messageIndex) => {
                  const textParts = message.parts.filter(
                    (part) => part.type === "text" && part.text.length > 0,
                  );
                  if (message.role === "assistant" && textParts.length === 0) return null;
                  const isLatestAssistant =
                    message.role === "assistant" && message.id === lastAssistantMessage?.id;
                  const isActiveAssistant =
                    isLatestAssistant && isStreaming;
                  const fullText = textParts.map((part) => (part.type === "text" ? part.text : "")).join("");
                  const messageImages = message.role === "assistant"
                    ? message.metadata?.images ?? []
                    : [];
                  const messageQuestion = message.role === "assistant" ? parsePlanQuestion(fullText) : null;
                  const precedingUserMessage = message.role === "assistant"
                    ? messages.slice(0, messageIndex).findLast((item) => item.role === "user")
                    : null;
                  const precedingUserText = precedingUserMessage?.parts
                    .filter((part) => part.type === "text")
                    .map((part) => (part.type === "text" ? part.text : ""))
                    .join("") ?? "";
                  const isResearchMessage = message.role === "assistant"
                    && (
                      message.metadata?.mode === "research"
                      || (isLatestAssistant && lastRunMode === "research")
                    );
                  const researchQuery = precedingUserText || activeResearchQuery;
                  const researchRunId =
                    message.metadata?.research?.runId ?? (isLatestAssistant ? activeRunId : null) ?? null;
                  // Q14 auto-attach: persisted artifacts (metadata.artifacts) survive
                  // reload; the live turn instead reads straight off the in-memory
                  // `activity` stream since persistence only happens once the turn ends.
                  const messageArtifacts =
                    message.role === "assistant"
                      ? message.metadata?.artifacts ??
                        (isActiveAssistant
                          ? activity
                              .filter(
                                (item): item is HermesActivityData & { kind: "tool"; filePath: string } =>
                                  item.kind === "tool" && item.status === "completed" && !item.error && Boolean(item.filePath),
                              )
                              .map((item) => ({ filePath: item.filePath, fileName: item.fileName }))
                          : [])
                      : [];
                  // Same persisted-vs-live split as messageArtifacts, for the
                  // code_exec showcase chip (Q12 reload survival).
                  const messageShowcases: HermesShowcaseData[] =
                    message.role === "assistant"
                      ? message.metadata?.showcases ?? (isActiveAssistant ? showcases : [])
                      : [];
                  return (
                    <div key={message.id} className={`message ${message.role === "user" ? "user" : "ai"}`}>
                      <div className="message-content">
                        <div
                          className={`message-bubble${isResearchMessage ? " research-message-bubble" : ""}${
                            messageImages.length ? " generated-image-message" : ""
                          }`}
                        >
                          {isResearchMessage && (
                            <ResearchProgressCard
                              query={researchQuery}
                              events={isLatestAssistant ? timelineEvents : []}
                              summary={message.metadata?.research}
                              isRunning={isActiveAssistant}
                              hasReportText={fullText.length > 0}
                              onStopAndEdit={
                                isActiveAssistant
                                  ? () => handleResearchStopAndEdit(researchQuery)
                                  : undefined
                              }
                            />
                          )}
                          {isActiveAssistant && !isResearchMessage && <MascotStatusBadge state={mascotState} />}
                          {message.role === "assistant" ? (
                            messageQuestion ? (
                              <p className="plan-question-recap">
                                <HelpCircle className="w-3.5 h-3.5" /> {messageQuestion.question}
                              </p>
                            ) : (
                              splitMessageSegments(fullText).map((seg, i) =>
                                seg.type === "code" ? (
                                  <button
                                    key={i}
                                    type="button"
                                    className="code-chip"
                                    onClick={() => openWorkspaceEntry(message.id)}
                                  >
                                    <FileCode className="w-3.5 h-3.5" />
                                    {seg.lang || "code"} — view in panel
                                  </button>
                                ) : (
                                  seg.value.trim() && <MarkdownMessage key={i} text={seg.value} />
                                ),
                              )
                            )
                          ) : (
                            textParts.map((part, i) => (
                              <span key={i} className="whitespace-pre-wrap">
                                {part.type === "text" ? part.text : null}
                              </span>
                            ))
                          )}
                          {messageImages.map((image) => (
                            <GeneratedImageCard
                              key={image.id}
                              image={image}
                              onEdit={handleGeneratedImageEdit}
                              onVariation={handleGeneratedImageVariation}
                              onOpen={handleGeneratedImageOpen}
                            />
                          ))}
                          {messageArtifacts.length > 0 && (
                            <div className="message-artifacts">
                              {messageArtifacts.map((artifact, i) => (
                                <a
                                  key={i}
                                  href={artifact.filePath}
                                  download={artifact.fileName}
                                  className="message-artifact-card"
                                >
                                  <Download className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--aio-subtle)" }} aria-hidden />
                                  <span className="truncate">{artifact.fileName ?? "Download file"}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          {messageShowcases.map((showcase) => {
                            const running = showcase.status === "running";
                            const errored = showcase.status === "error";
                            const scriptName = showcase.taskData.scriptPath?.split("/").pop() ?? "script";
                            return (
                              <div key={showcase.taskId}>
                                <button
                                  type="button"
                                  className={`showcase-chip${errored ? " error" : ""}`}
                                  disabled={running}
                                  onClick={() => openShowcasePanel(showcase)}
                                >
                                  {running ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                                  ) : errored ? (
                                    <CircleAlert className="w-3.5 h-3.5" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>Code Execution</span>
                                  {!isMobileViewport && (
                                    <span className="truncate">
                                      {errored ? "Run failed for " : "Created & ran "}
                                      {scriptName}
                                    </span>
                                  )}
                                </button>
                                {errored && (
                                  <ShowcaseErrorDetail stdout={showcase.taskData.stdout} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {message.role === "assistant" && !isActiveAssistant && (
                          <div className="message-meta">
                            <button
                              type="button"
                              className="copy-btn"
                              onClick={() => handleCopyMessage(message.id, fullText)}
                              aria-label="Copy message"
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {isResearchMessage && fullText.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  className="copy-btn"
                                  onClick={() => handleDownloadReportMarkdown(researchQuery, fullText)}
                                  aria-label="Download report as Markdown"
                                  title="Download report as Markdown"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="copy-btn"
                                  onClick={() => handleExportReportPdf(researchQuery, fullText)}
                                  aria-label="Export report as PDF"
                                  title="Export report as PDF"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                {researchRunId && (
                                  <button
                                    type="button"
                                    className="copy-btn"
                                    onClick={() => handleToggleSources(researchRunId)}
                                    aria-label="Show sources"
                                    title="Show sources"
                                  >
                                    <Link2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {isResearchMessage && researchRunId && openSourcesRunId === researchRunId && (
                          <div className="research-sources-panel">
                            {sourcesLoadingRunId === researchRunId ? (
                              <p className="research-sources-status">Loading sources…</p>
                            ) : sourcesErrorRunId === researchRunId ? (
                              <p className="research-sources-status">Couldn&apos;t load sources.</p>
                            ) : (sourcesByRunId[researchRunId]?.length ?? 0) === 0 ? (
                              <p className="research-sources-status">No sources recorded for this run.</p>
                            ) : (
                              <ul className="research-sources-list">
                                {sourcesByRunId[researchRunId]!.map((source) => (
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
                      </div>
                    </div>
                  );
                })}

                {imageGenerationStatus && (
                  <div className="message ai">
                    <div className="message-content">
                      <div className="message-bubble generated-image-message">
                        <ImageGenerationProgress
                          status={imageGenerationStatus}
                          onCancel={cancelImageGeneration}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isStreaming && !hasText && (
                  <div className="message ai">
                    <div className="message-content">
                      <div className={`message-bubble${lastRunMode === "research" ? " research-message-bubble" : ""}`}>
                        {lastRunMode === "research" ? (
                          <ResearchProgressCard
                            query={activeResearchQuery}
                            events={timelineEvents}
                            isRunning
                            hasReportText={false}
                            onStopAndEdit={() => handleResearchStopAndEdit(activeResearchQuery)}
                          />
                        ) : (
                          <MascotStatusBadge state={mascotState} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {showScrollToBottom && (
                  <button
                    type="button"
                    className="scroll-to-bottom-btn"
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                    aria-label="Scroll to latest message"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="input-area">
            <div className="input-container">
              {pendingApproval && (
                <div style={{ marginBottom: 10 }}>
                  <div className="approval-card">
                    <div className="approval-card-head">
                      <Check className="w-4 h-4" />
                      <span className="approval-card-title">Approval requested</span>
                    </div>
                    {pendingApproval.description && (
                      <p className="approval-card-desc">{pendingApproval.description}</p>
                    )}
                    {pendingApproval.command && (
                      <code className="approval-card-cmd">{pendingApproval.command}</code>
                    )}
                    <div className="approval-card-actions">
                      <button
                        type="button"
                        className="approval-btn approve"
                        onClick={() => handleApprovalRespond(pendingApproval.requestId, pendingApproval.runId, "session")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="approval-btn deny"
                        onClick={() => handleApprovalRespond(pendingApproval.requestId, pendingApproval.runId, "deny")}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {planQuestion && status === "ready" && (
                <div style={{ marginBottom: 10 }}>
                  <div className="plan-question-card" role="group" aria-label="Clarifying question">
                    <div className="plan-card-head">
                      <HelpCircle className="w-4 h-4" />
                      <span className="plan-card-title">Quick question</span>
                    </div>
                    <p className="plan-card-desc">{planQuestion.question}</p>
                    <div className="plan-question-options">
                      {planQuestion.choices.slice(0, 3).map((choice, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`plan-question-option${planQuestion.recommended === i ? " recommended" : ""}`}
                          onClick={() => handlePlanAnswer(choice)}
                        >
                          {choice}
                          {planQuestion.recommended === i && <span className="plan-question-badge">Recommended</span>}
                        </button>
                      ))}
                      <div className="plan-question-other">
                        <input
                          type="text"
                          value={planOtherText}
                          onChange={(e) => setPlanOtherText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handlePlanAnswer(planOtherText);
                            }
                          }}
                          placeholder="Other — type your own answer"
                          className="plan-question-other-input"
                        />
                        <button
                          type="button"
                          className="plan-btn adjust"
                          disabled={!planOtherText.trim()}
                          onClick={() => handlePlanAnswer(planOtherText)}
                        >
                          <ArrowRight className="w-3.5 h-3.5" /> Next
                        </button>
                      </div>
                    </div>
                    <button type="button" className="plan-question-skip" onClick={handlePlanSkipToPlan}>
                      <SkipForward className="w-3.5 h-3.5" /> Skip to plan
                    </button>
                  </div>
                </div>
              )}

              {planAwaitingAction && !planQuestion && status === "ready" && hasText && (
                <div style={{ marginBottom: 10 }}>
                  <div className="plan-card" role="group" aria-label="Plan ready">
                    <div className="plan-card-head">
                      <ListChecks className="w-4 h-4" />
                      <span className="plan-card-title">Plan ready</span>
                    </div>
                    <p className="plan-card-desc">Review the plan above, then choose how to proceed.</p>
                    <div className="plan-card-actions">
                      <button type="button" className="plan-btn run" onClick={handlePlanRun}>
                        <Play className="w-3.5 h-3.5" /> Run plan
                      </button>
                      <button type="button" className="plan-btn adjust" onClick={handlePlanAdjust}>
                        <PenLine className="w-3.5 h-3.5" /> Adjust
                      </button>
                      <button type="button" className="plan-btn cancel" onClick={handlePlanCancel}>
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {chatError && insufficientCreditsError && (
                <div
                  className="memory-text"
                  style={{ color: "var(--accent-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span>{insufficientCreditsError.message || "Not enough credits for this task. Top up your balance to continue."}</span>
                  <button
                    type="button"
                    className="approval-btn approve"
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => {
                      clearError();
                      setSettingsInitialTab("plan");
                      setSettingsOpen(true);
                    }}
                  >
                    View plans
                  </button>
                  <button
                    type="button"
                    className="approval-btn deny"
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => clearError()}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {chatError && !insufficientCreditsError && (
                <div
                  className="memory-text"
                  style={{ color: "var(--accent-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span>{chatError.message || "Something went wrong sending that message."}</span>
                  <button
                    type="button"
                    className="approval-btn approve"
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => {
                      clearError();
                      regenerate();
                    }}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="approval-btn deny"
                    style={{ padding: "2px 10px", fontSize: 12 }}
                    onClick={() => clearError()}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {imageGenerationError && (
                <div className="image-generation-error" role="alert">
                  <CircleAlert className="w-4 h-4" />
                  <span>{imageGenerationError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(imageLastPrompt);
                      setImageGenerationError(null);
                      focusComposer();
                    }}
                  >
                    Edit prompt
                  </button>
                  <button
                    type="button"
                    className="icon-only"
                    onClick={() => setImageGenerationError(null)}
                    aria-label="Dismiss image generation error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {imageComposerActive && (
                  <div className="image-composer-toolbar" aria-label="Image creation options">
                    <div className="image-composer-mode">
                      <ImageIcon className="w-4 h-4" />
                      <span>{imageReference ? "Edit image" : "Create image"}</span>
                    </div>
                    {imageReference && (
                      <button
                        type="button"
                        className="image-reference-chip"
                        onClick={() => handleGeneratedImageOpen(imageReference)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageReference.url} alt="" />
                        <span>Reference</span>
                      </button>
                    )}
                    <label className="image-composer-select">
                      <span className="sr-only">Aspect ratio</span>
                      <select
                        value={imageAspectRatio}
                        onChange={(event) => setImageAspectRatio(event.target.value as ImageAspectRatio)}
                        disabled={Boolean(imageGenerationStatus)}
                      >
                        {IMAGE_ASPECT_RATIOS.map((aspect) => (
                          <option
                            key={aspect.value}
                            value={aspect.value}
                            disabled={imageResolution === "4K" && aspect.value === "1:1"}
                          >
                            {aspect.label} · {aspect.value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="image-resolution-control" role="group" aria-label="Resolution">
                      {(["1K", "2K", "4K"] as ImageResolution[]).map((resolution) => (
                        <button
                          key={resolution}
                          type="button"
                          className={imageResolution === resolution ? "active" : ""}
                          disabled={Boolean(imageGenerationStatus)}
                          onClick={() => {
                            setImageResolution(resolution);
                            if (resolution === "4K" && imageAspectRatio === "1:1") {
                              setImageAspectRatio("16:9");
                            }
                          }}
                        >
                          {resolution}
                        </button>
                      ))}
                    </div>
                    <span className="image-cost">
                      ${IMAGE_COST_USD[imageResolution].toFixed(2)} est.
                    </span>
                    <button
                      type="button"
                      className="image-composer-close"
                      disabled={Boolean(imageGenerationStatus)}
                      onClick={() => {
                        setImageComposerActive(false);
                        setImageReference(null);
                        setImageGenerationError(null);
                      }}
                      aria-label="Close image creation"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) void addAttachments(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
                {pendingAttachments.length > 0 && (
                  <div className="composer-attachments-row">
                    {pendingAttachments.map((att, i) => (
                      <button
                        type="button"
                        className="image-reference-chip"
                        key={`${att.filename ?? "image"}-${i}`}
                        onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove ${att.filename ?? "image"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={att.url} alt="" />
                        <span>{att.filename ?? "image"}</span>
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
                {attachmentError && (
                  <div className="memory-text" style={{ color: "var(--accent-secondary)", marginBottom: 8 }}>
                    <span>{attachmentError}</span>
                  </div>
                )}
                <div
                  className={`input-wrapper${inputFocused ? " focused" : ""}${inputMultiline ? " multiline" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer?.files ?? []);
                    if (files.length) void addAttachments(files);
                  }}
                >
                  <div className="input-tools composer-plus-wrapper" ref={composerMenuRef}>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-full"
                      aria-label="More options"
                      aria-haspopup="menu"
                      aria-expanded={composerMenuOpen}
                      onClick={() => setComposerMenuOpen((open) => !open)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    {composerMenuOpen && (
                      <div className="composer-tray" role="menu">
                        <div className="composer-tray-section">
                          <span className="composer-tray-section-label">Attach</span>
                          <div className="composer-tray-grid">
                            <button
                              type="button"
                              className="composer-tray-card composer-tray-card--wide"
                              role="menuitem"
                              onClick={() => {
                                setComposerMenuOpen(false);
                                attachmentInputRef.current?.click();
                              }}
                            >
                              <span className="composer-tray-card-icon">
                                <Paperclip className="w-5 h-5" />
                              </span>
                              <span className="composer-tray-card-body">
                                <span className="composer-tray-card-title">
                                  <span className="composer-tray-card-title-text">Photos &amp; files</span>
                                </span>
                                <span className="composer-tray-card-subtitle">Upload, or drag &amp; drop</span>
                              </span>
                            </button>
                          </div>
                        </div>
                        <div className="composer-tray-section">
                          <span className="composer-tray-section-label">Create</span>
                          <div className="composer-tray-grid">
                            <button
                              type="button"
                              className="composer-tray-card"
                              role="menuitem"
                              onClick={() => activateImageComposer()}
                            >
                              <span className="composer-tray-card-icon">
                                <ImageIcon className="w-5 h-5" />
                              </span>
                              <span className="composer-tray-card-body">
                                <span className="composer-tray-card-title">
                                  <span className="composer-tray-card-title-text">Image</span>
                                </span>
                                <span className="composer-tray-card-subtitle">Generate an image</span>
                              </span>
                            </button>
                            <button type="button" className="composer-tray-card" role="menuitem" disabled>
                              <span className="composer-tray-card-icon">
                                <PenLine className="w-5 h-5" />
                              </span>
                              <span className="composer-tray-card-body">
                                <span className="composer-tray-card-title">
                                  <span className="composer-tray-card-title-text">Edit image</span>
                                  <span className="composer-tray-card-tag">New</span>
                                </span>
                                <span className="composer-tray-card-subtitle">Touch up a photo</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="composer-tray-card composer-tray-card--wide"
                              role="menuitem"
                              disabled
                            >
                              <span className="composer-tray-card-icon">
                                <Video className="w-5 h-5" />
                              </span>
                              <span className="composer-tray-card-body">
                                <span className="composer-tray-card-title">
                                  <span className="composer-tray-card-title-text">Video</span>
                                  <span className="composer-tray-card-tag composer-tray-card-tag--soon">Soon</span>
                                </span>
                                <span className="composer-tray-card-subtitle">Generate a short video</span>
                              </span>
                            </button>
                          </div>
                        </div>
                        <div className="composer-tray-section">
                          <span className="composer-tray-section-label">Build &amp; work</span>
                          <div className="composer-tray-grid">
                            <button type="button" className="composer-tray-card" role="menuitem" disabled>
                              <span className="composer-tray-card-icon">
                                <Globe className="w-5 h-5" />
                              </span>
                              <span className="composer-tray-card-body">
                                <span className="composer-tray-card-title">
                                  <span className="composer-tray-card-title-text">Website</span>
                                  <span className="composer-tray-card-tag composer-tray-card-tag--soon">Soon</span>
                                </span>
                                <span className="composer-tray-card-subtitle">Build a page</span>
                              </span>
                            </button>
                            <button type="button" className="composer-tray-card" role="menuitem" disabled>
                              <span className="composer-tray-card-icon">
                                <LayoutGrid className="w-5 h-5" />
                              </span>
                              <span className="composer-tray-card-body">
                                <span className="composer-tray-card-title">
                                  <span className="composer-tray-card-title-text">Google Workspace</span>
                                  <span className="composer-tray-card-tag composer-tray-card-tag--soon">Soon</span>
                                </span>
                                <span className="composer-tray-card-subtitle">Docs, Sheets, Slides</span>
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="message-input"
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      setInputFocused(true);
                      setComposerMenuOpen(false);
                    }}
                    onBlur={() => setInputFocused(false)}
                    onPaste={(e) => {
                      const files = Array.from(e.clipboardData?.files ?? []);
                      if (files.length) {
                        e.preventDefault();
                        void addAttachments(files);
                      }
                    }}
                    placeholder={
                      imageComposerActive
                        ? isMobileViewport
                          ? "Describe your image..."
                          : "Describe the image you want to create..."
                        : "Describe a task for Aio..."
                    }
                    disabled={status !== "ready" || Boolean(imageGenerationStatus)}
                    rows={1}
                  />
                  {imageComposerActive ? (
                    <span className="image-mode-indicator">Image</span>
                  ) : (
                    <>
                      <ChatModeMenu value={chatMode} onValueChange={setChatMode} />
                      <SavedAgentMenu value={activeSavedAgentId} onValueChange={setActiveSavedAgentId} />
                    </>
                  )}
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={
                      status !== "ready" ||
                      Boolean(imageGenerationStatus) ||
                      (!input.trim() && pendingAttachments.length === 0)
                    }
                    aria-label="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* ===== RIGHT PANEL ===== */}
        <RightPanel
          rightPanelCollapsed={rightPanelCollapsed}
          setRightPanelCollapsed={setRightPanelCollapsed}
          rightPanelWidth={rightPanelWidth}
          handleRightPanelResizeStart={handleRightPanelResizeStart}
          liveStatusIsProcessing={liveStatusIsProcessing}
          liveStatusText={liveStatusText}
          durableRunVisible={durableRunVisible}
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
          usedPercentLabel={usedPercentLabel}
          usageLevel={usageLevel}
          usagePercentValue={usagePercentValue}
          resetDateLabel={resetDateLabel}
          activeTodayCards={activeTodayCards}
          handleTodayAction={handleTodayAction}
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
