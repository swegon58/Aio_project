"use client";

import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  FileCode,
  FileText,
  HelpCircle,
  Loader2,
  PencilLine,
  Search,
} from "lucide-react";
import { Mascot, MascotStatusBadge } from "@/components/app/Mascot";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";
import TextType from "@/components/app/TextType";
import { TASK_TEMPLATES } from "@/components/app/TemplateGallery";
import { ResearchProgressCard } from "@/components/app/run-timeline/ResearchProgressCard";
import { ResearchPlanCard } from "@/components/app/run-timeline/ResearchPlanCard";
import { GeneratedImageCard, ImageGenerationProgress } from "@/components/app/GeneratedImageCard";
import { OnboardingOverlay } from "@/components/app/OnboardingOverlay";
import { ShowcaseErrorDetail } from "@/components/app/FilePreview";
import { CurrentRunCard } from "@/components/app/app-home/sections/CurrentRunCard";
import { TodayCard } from "@/components/app/app-home/sections/TodayCard";
import {
  latestResearchStageEvent,
  parsePlanQuestion,
  reportSummary,
  splitMessageSegments,
} from "@/components/app/app-home-utils";
import type { TodayAction, TodayCard as TodayCardData } from "@/components/app/app-home-types";
import type { AgentDisplayState } from "@/components/app/run-timeline";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import type { AioRunEvent, AioRunStatus } from "@/lib/aio/runs/aio-run-events";
import type {
  HermesActivityData,
  HermesShowcaseData,
  HermesUIMessage,
  MascotImageState,
} from "@/lib/hermes/chat-types";
import { useChatRuntime, useWorkspace, useAccountData } from "@/components/app/app-home/context";

// R13.3 item 1/2: shared "Deep research" card shell (kicker + question title
// + optional Stop & edit) — reused for the live per-search progress card and
// the finished-report result card, so both keep the same question-specific
// header instead of duplicating it per call site.
function ResearchCardShell({
  query,
  onStopAndEdit,
  children,
}: {
  query: string;
  onStopAndEdit?: () => void;
  children?: ReactNode;
}) {
  const displayQuery = query.trim() || "Deep research";
  return (
    <section className="research-progress-card" aria-label="Deep research">
      <div className="research-progress-head">
        <div className="research-progress-heading">
          <span className="research-progress-kicker">
            <Search className="w-3.5 h-3.5" />
            Deep research
          </span>
          <h3 title={displayQuery}>{displayQuery}</h3>
        </div>
        {onStopAndEdit && (
          <button type="button" className="research-edit-btn" onClick={onStopAndEdit}>
            <PencilLine className="w-3.5 h-3.5" />
            Stop &amp; edit
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

interface MessageListProps {
  chatAreaRef: RefObject<HTMLDivElement | null>;
  handleChatScroll: () => void;
  messages: HermesUIMessage[];
  mascotState: MascotImageState;
  greetingLines: string[];
  isMobileViewport: boolean;
  activeTodayCards: TodayCardData[];
  handleTodayAction: (card: TodayCardData, action: TodayAction) => void;
  durableRunVisible: boolean;
  currentRunBadgeState: AgentDisplayState;
  currentRunStatusLabel: string;
  currentRunNote: string;
  currentRunCanStop: boolean;
  runStopPending: boolean;
  handleDurableRunStop: () => Promise<void> | void;
  currentRunTone: "warning" | "working" | "approval" | "default";
  timelineHydrating: boolean;
  runStopError: string | null;
  timelineSyncError: string | null;
  persistedRunStatus: AioRunStatus | null;
  timelineEvents: AioRunEvent[];
  handleTimelineApprovalResolve: (approvalId: string, runId: string, choice: "approve" | "reject") => Promise<void>;
  setInput: Dispatch<SetStateAction<string>>;
  lastAssistantMessage: HermesUIMessage | undefined;
  isStreaming: boolean;
  hasText: boolean;
  activity: HermesActivityData[];
  showcases: HermesShowcaseData[];
  lastRunMode: AioChatMode;
  activeResearchQuery: string;
  openWorkspaceEntry: (messageId: string) => void;
  openShowcasePanel: (showcase: HermesShowcaseData) => void;
  copiedMessageId: string | null;
  handleCopyMessage: (id: string, text: string) => void;
  openReportPanel: (query: string, reportText: string, runId: string | null) => void;
  showScrollToBottom: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function MessageList({
  chatAreaRef,
  handleChatScroll,
  messages,
  mascotState,
  greetingLines,
  isMobileViewport,
  activeTodayCards,
  handleTodayAction,
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
  setInput,
  lastAssistantMessage,
  isStreaming,
  hasText,
  activity,
  showcases,
  lastRunMode,
  activeResearchQuery,
  openWorkspaceEntry,
  openShowcasePanel,
  copiedMessageId,
  handleCopyMessage,
  openReportPanel,
  showScrollToBottom,
  messagesEndRef,
}: MessageListProps) {
  const { activeRunId, handleResearchStopAndEdit } = useChatRuntime();
  const {
    imageGenerationStatus,
    handleGeneratedImageOpen,
    handleGeneratedImageEdit,
    handleGeneratedImageVariation,
    cancelImageGeneration,
    setLightboxImage,
  } = useWorkspace();
  const { onboardedAt, setOnboardedAt } = useAccountData();

  return (
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
            const fileParts = message.role === "user"
              ? message.parts.filter(
                  (part): part is Extract<HermesUIMessage["parts"][number], { type: "file" }> =>
                    part.type === "file" && part.mediaType.startsWith("image/"),
                )
              : [];
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
                    {isResearchMessage && (isActiveAssistant || fullText.length === 0) && (
                      <ResearchCardShell
                        query={researchQuery}
                        onStopAndEdit={
                          isActiveAssistant
                            ? () => handleResearchStopAndEdit(researchQuery)
                            : undefined
                        }
                      >
                        {(() => {
                          const stageEvent = latestResearchStageEvent(isLatestAssistant ? timelineEvents : []);
                          if (!stageEvent) return null;
                          return (
                            <>
                              {stageEvent.plan && <ResearchPlanCard plan={stageEvent.plan} bare />}
                              <ResearchProgressCard event={stageEvent} bare />
                            </>
                          );
                        })()}
                      </ResearchCardShell>
                    )}
                    {isActiveAssistant && !isResearchMessage && <MascotStatusBadge state={mascotState} />}
                    {message.role === "assistant" ? (
                      messageQuestion ? (
                        <p className="plan-question-recap">
                          <HelpCircle className="w-3.5 h-3.5" /> {messageQuestion.question}
                        </p>
                      ) : isResearchMessage && fullText.length > 0 && !isActiveAssistant ? (
                        <ResearchCardShell query={researchQuery}>
                          <MarkdownMessage text={reportSummary(fullText)} />
                          <button
                            type="button"
                            className="code-chip"
                            onClick={() => openReportPanel(researchQuery, fullText, researchRunId)}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Open report
                          </button>
                        </ResearchCardShell>
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
                    {fileParts.length > 0 && (
                      <div className="message-attachments">
                        {fileParts.map((part, i) => (
                          <button
                            type="button"
                            key={`${message.id}-attachment-${i}`}
                            className="message-attachment-thumb"
                            onClick={() =>
                              setLightboxImage({
                                id: `${message.id}-attachment-${i}`,
                                sessionId: null,
                                caption: part.filename ?? null,
                                createdAt: "",
                                url: part.url,
                                bare: true,
                              })
                            }
                            aria-label={`View ${part.filename ?? "attached image"}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={part.url} alt="" />
                          </button>
                        ))}
                      </div>
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
                    <ResearchCardShell
                      query={activeResearchQuery}
                      onStopAndEdit={() => handleResearchStopAndEdit(activeResearchQuery)}
                    >
                      {(() => {
                        const stageEvent = latestResearchStageEvent(timelineEvents);
                        if (!stageEvent) return null;
                        return (
                          <>
                            {stageEvent.plan && <ResearchPlanCard plan={stageEvent.plan} bare />}
                            <ResearchProgressCard event={stageEvent} bare />
                          </>
                        );
                      })()}
                    </ResearchCardShell>
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
  );
}
