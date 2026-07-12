import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { FileUIPart } from "ai";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import type { HermesActivityData, HermesApprovalData, HermesShowcaseData } from "@/lib/hermes/chat-types";
import type { ImageGenerationStatus } from "@/components/app/app-home-types";

interface UseChatComposerParams {
  status: "submitted" | "streaming" | "ready" | "error";
  stop: () => void;
  sendMessage: (
    message: { text: string; files?: FileUIPart[] },
    options: { body: { mode: AioChatMode; savedAgentId?: string | null } },
  ) => void;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  pendingAttachments: FileUIPart[];
  setPendingAttachments: Dispatch<SetStateAction<FileUIPart[]>>;
  setAttachmentError: Dispatch<SetStateAction<string | null>>;
  setInputMultiline: Dispatch<SetStateAction<boolean>>;
  chatMode: AioChatMode;
  setChatMode: Dispatch<SetStateAction<AioChatMode>>;
  activeSavedAgentId: string | null;
  setLastRunMode: Dispatch<SetStateAction<AioChatMode>>;
  setActiveResearchQuery: Dispatch<SetStateAction<string>>;
  imageGenerationStatus: ImageGenerationStatus | null;
  imageComposerActive: boolean;
  submitImageGeneration: (prompt: string) => Promise<void>;
  setActivity: Dispatch<SetStateAction<HermesActivityData[]>>;
  primeOptimisticRunRef: MutableRefObject<() => void>;
  setShowcases: Dispatch<SetStateAction<HermesShowcaseData[]>>;
  setPendingApproval: Dispatch<SetStateAction<Extract<HermesApprovalData, { kind: "request" }> | null>>;
  setPlanAwaitingAction: Dispatch<SetStateAction<boolean>>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  messagesEndRef: MutableRefObject<HTMLDivElement | null>;
}

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

// Composer submit/input/attachment orchestration, extracted verbatim from
// AppHome.tsx. `input`/`pendingAttachments`/`composerMenuOpen` etc. stay
// owned by the shell rather than this hook because useImageGeneration (which
// must run earlier so its real setters are available here) already needs
// them as eager args — see useImageGeneration's own params.
export function useChatComposer({
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
}: UseChatComposerParams) {
  const addAttachments = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    const oversized = images.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setAttachmentError(`${oversized.name} is over 8MB.`);
      return;
    }
    if (pendingAttachments.length + images.length > MAX_ATTACHMENTS) {
      setAttachmentError(`Up to ${MAX_ATTACHMENTS} images per message.`);
      return;
    }
    setAttachmentError(null);
    const parts = await Promise.all(
      images.map(
        (file) =>
          new Promise<FileUIPart>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({ type: "file", mediaType: file.type, url: reader.result as string, filename: file.name });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
    setPendingAttachments((prev) => [...prev, ...parts]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && pendingAttachments.length === 0) || status !== "ready" || imageGenerationStatus) return;
    const submittedText = input.trim();
    if (imageComposerActive) {
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setInputMultiline(false);
      void submitImageGeneration(submittedText);
      return;
    }
    setActivity([]);
    primeOptimisticRunRef.current();
    setShowcases([]);
    setPendingApproval(null);
    // R15 C9 — research mode now shares the same wizard/approval gate as plan mode.
    setPlanAwaitingAction(chatMode === "plan" || chatMode === "research");
    setLastRunMode(chatMode);
    if (chatMode === "research") setActiveResearchQuery(submittedText);
    sendMessage(
      { text: submittedText, files: pendingAttachments },
      { body: { mode: chatMode, savedAgentId: activeSavedAgentId } },
    );
    setInput("");
    setPendingAttachments([]);
    setAttachmentError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setInputMultiline(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    setInputMultiline(el.scrollHeight > 40);
  };

  const focusComposer = () => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleResearchStopAndEdit = (query: string) => {
    if (status !== "ready") void stop();
    setChatMode("research");
    setInput(query);
    focusComposer();
  };

  return {
    addAttachments,
    handleSubmit,
    handleKeyDown,
    handleInput,
    focusComposer,
    handleResearchStopAndEdit,
  };
}
