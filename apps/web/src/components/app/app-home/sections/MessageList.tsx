"use client";

import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import { memo, useMemo } from "react";
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
import {
  latestResearchStageEvent,
  parsePlanQuestion,
  parsePlanQuestions,
  parseResearchPlan,
  reportSummary,
  splitMessageSegments,
} from "@/components/app/app-home-utils";
import type { AgentDisplayState } from "@/components/app/run-timeline";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import type { AioRunEvent, AioRunStatus } from "@/lib/aio/runs/aio-run-events";
import type {
  AioGeneratedImage,
  HermesActivityData,
  HermesShowcaseData,
  HermesUIMessage,
  MascotImageState,
} from "@/lib/hermes/chat-types";
import type { GalleryImage } from "@/components/app/app-home-types";
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

interface MessageRowProps {
  message: HermesUIMessage;
  firstUserText: string;
  isLatestAssistant: boolean;
  isActiveAssistant: boolean;
  mascotState: MascotImageState;
  isMobileViewport: boolean;
  timelineEvents: AioRunEvent[];
  activity: HermesActivityData[];
  showcases: HermesShowcaseData[];
  lastRunMode: AioChatMode;
  activeResearchQuery: string;
  activeRunId: string | null;
  handleResearchStopAndEdit: (query: string) => void;
  openWorkspaceEntry: (messageId: string) => void;
  openShowcasePanel: (showcase: HermesShowcaseData) => void;
  copiedMessageId: string | null;
  handleCopyMessage: (id: string, text: string) => void;
  openReportPanel: (query: string, reportText: string, runId: string | null) => void;
  handleGeneratedImageEdit: (image: AioGeneratedImage) => void;
  handleGeneratedImageVariation: (image: AioGeneratedImage) => void;
  handleGeneratedImageOpen: (image: AioGeneratedImage) => void;
  setLightboxImage: Dispatch<SetStateAction<GalleryImage | null>>;
}

// A1/A2 (R15 streaming-jitter root cause): messages.map() used to run every
// message's regex parsing (parsePlanQuestion/parsePlanQuestions/
// splitMessageSegments) on every render triggered by a single streaming
// token, since a new array + new JSX was produced for the whole list each
// time. Wrapping each row in memo() with a comparator that ignores
// unstable-identity callback props (AppHome doesn't useCallback them, so a
// default shallow compare would never skip) means only the row whose actual
// inputs changed re-renders and re-parses.
const MessageRow = memo(function MessageRow({
  message,
  firstUserText,
  isLatestAssistant,
  isActiveAssistant,
  mascotState,
  isMobileViewport,
  timelineEvents,
  activity,
  showcases,
  lastRunMode,
  activeResearchQuery,
  activeRunId,
  handleResearchStopAndEdit,
  openWorkspaceEntry,
  openShowcasePanel,
  copiedMessageId,
  handleCopyMessage,
  openReportPanel,
  handleGeneratedImageEdit,
  handleGeneratedImageVariation,
  handleGeneratedImageOpen,
  setLightboxImage,
}: MessageRowProps) {
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
  const fullText = textParts.map((part) => (part.type === "text" ? part.text : "")).join("");
  const messageImages = message.role === "assistant"
    ? message.metadata?.images ?? []
    : [];
  const messageQuestion = message.role === "assistant" ? parsePlanQuestion(fullText) : null;
  // R15 C5/C9 — batch aio-questions block and the research-mode
  // aio-research-plan block both need a recap here too, otherwise
  // they'd fall through to raw JSON (plan questions) or the
  // "final report" treatment below (research plan block).
  const messageQuestions = message.role === "assistant" ? parsePlanQuestions(fullText) : null;
  const messageResearchPlan = message.role === "assistant" ? parseResearchPlan(fullText) : null;
  const isResearchMessage = message.role === "assistant"
    && (
      message.metadata?.mode === "research"
      || (isLatestAssistant && lastRunMode === "research")
    );
  // R15 fix — the research "query" heading must be the thread's original
  // ask (firstUserText), not whatever user message happens to precede this
  // assistant turn: after the plan/research wizard, that's the synthetic
  // wizard-summary or Approve confirm text, which would otherwise corrupt
  // the heading, "Stop & edit" prefill, and report title.
  const researchQuery = (message.role === "assistant" ? firstUserText : "") || activeResearchQuery;
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
    <div className={`message ${message.role === "user" ? "user" : "ai"}`}>
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
            ) : messageQuestions ? (
              <p className="plan-question-recap">
                <HelpCircle className="w-3.5 h-3.5" /> Asked {messageQuestions.length} clarifying question
                {messageQuestions.length === 1 ? "" : "s"}
              </p>
            ) : messageResearchPlan ? (
              <ResearchPlanCard plan={messageResearchPlan} />
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
          ) : message.metadata?.planWizardAnswers ? (
            <ol className="plan-wizard-review">
              {message.metadata.planWizardAnswers.map((a, i) => (
                <li key={i} className="plan-wizard-review-item">
                  <span className="plan-wizard-review-q">{a.question}</span>
                  <span className="plan-wizard-review-a">{a.answer}</span>
                </li>
              ))}
            </ol>
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
}, (prev, next) => {
  if (prev.message !== next.message) return false;
  if (prev.isLatestAssistant !== next.isLatestAssistant) return false;
  if (prev.isActiveAssistant !== next.isActiveAssistant) return false;
  if (prev.mascotState !== next.mascotState) return false;
  if (prev.isMobileViewport !== next.isMobileViewport) return false;
  if (prev.lastRunMode !== next.lastRunMode) return false;
  if (prev.activeResearchQuery !== next.activeResearchQuery) return false;
  if (prev.firstUserText !== next.firstUserText) return false;
  if ((prev.copiedMessageId === prev.message.id) !== (next.copiedMessageId === next.message.id)) return false;
  if (prev.isLatestAssistant || next.isLatestAssistant) {
    // Live data only matters for the row currently streaming/researching —
    // other rows never read timelineEvents/activity/showcases.
    if (prev.timelineEvents !== next.timelineEvents) return false;
    if (prev.activity !== next.activity) return false;
    if (prev.showcases !== next.showcases) return false;
    if (prev.activeRunId !== next.activeRunId) return false;
  }
  return true;
});

interface MessageListProps {
  chatAreaRef: RefObject<HTMLDivElement | null>;
  handleChatScroll: () => void;
  messages: HermesUIMessage[];
  mascotState: MascotImageState;
  greetingLines: string[];
  isMobileViewport: boolean;
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

  // Hoisted out of the per-message loop (was messages.find() per assistant
  // row, O(n) work repeated for every row on every render) — the thread's
  // first user message never changes after it's sent.
  const firstUserText = useMemo(() => {
    const firstUser = messages.find((item) => item.role === "user");
    return firstUser?.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("") ?? "";
  }, [messages]);

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
          {messages.map((message) => {
            const isLatestAssistant =
              message.role === "assistant" && message.id === lastAssistantMessage?.id;
            const isActiveAssistant = isLatestAssistant && isStreaming;
            return (
              <MessageRow
                key={message.id}
                message={message}
                firstUserText={firstUserText}
                isLatestAssistant={isLatestAssistant}
                isActiveAssistant={isActiveAssistant}
                mascotState={mascotState}
                isMobileViewport={isMobileViewport}
                timelineEvents={timelineEvents}
                activity={activity}
                showcases={showcases}
                lastRunMode={lastRunMode}
                activeResearchQuery={activeResearchQuery}
                activeRunId={activeRunId}
                handleResearchStopAndEdit={handleResearchStopAndEdit}
                openWorkspaceEntry={openWorkspaceEntry}
                openShowcasePanel={openShowcasePanel}
                copiedMessageId={copiedMessageId}
                handleCopyMessage={handleCopyMessage}
                openReportPanel={openReportPanel}
                handleGeneratedImageEdit={handleGeneratedImageEdit}
                handleGeneratedImageVariation={handleGeneratedImageVariation}
                handleGeneratedImageOpen={handleGeneratedImageOpen}
                setLightboxImage={setLightboxImage}
              />
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
