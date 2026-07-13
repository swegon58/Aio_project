"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import type { FileUIPart } from "ai";
import {
  Check,
  CircleAlert,
  Globe,
  ImageIcon,
  LayoutGrid,
  ListChecks,
  Paperclip,
  PenLine,
  Play,
  Plus,
  Send,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatModeMenu } from "@/components/app/ChatModeMenu";
import { SavedAgentMenu } from "@/components/app/SavedAgentMenu";
import { PlanWizard } from "@/components/app/app-home/sections/PlanWizard";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import type { HermesApprovalData } from "@/lib/hermes/chat-types";
import type { ImageAspectRatio, ImageResolution } from "@/components/app/app-home-types";
import { IMAGE_ASPECT_RATIOS } from "@/components/app/app-home-utils";
import { useChatRuntime, useWorkspace } from "@/components/app/app-home/context";

interface ComposerProps {
  pendingApproval: Extract<HermesApprovalData, { kind: "request" }> | null;
  handleApprovalRespond: (requestId: string, targetRunId: string, choice: "session" | "deny") => Promise<void> | void;
  insufficientCreditsError: { message?: string } | null;
  isMobileViewport: boolean;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  pendingAttachments: FileUIPart[];
  setPendingAttachments: Dispatch<SetStateAction<FileUIPart[]>>;
  attachmentError: string | null;
  attachmentInputRef: RefObject<HTMLInputElement | null>;
  inputFocused: boolean;
  setInputFocused: Dispatch<SetStateAction<boolean>>;
  inputMultiline: boolean;
  composerMenuOpen: boolean;
  setComposerMenuOpen: Dispatch<SetStateAction<boolean>>;
  composerMenuRef: RefObject<HTMLDivElement | null>;
  chatMode: AioChatMode;
  setChatMode: Dispatch<SetStateAction<AioChatMode>>;
  activeSavedAgentId: string | null;
  setActiveSavedAgentId: Dispatch<SetStateAction<string | null>>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function Composer({
  pendingApproval,
  handleApprovalRespond,
  insufficientCreditsError,
  isMobileViewport,
  input,
  setInput,
  pendingAttachments,
  setPendingAttachments,
  attachmentError,
  attachmentInputRef,
  inputFocused,
  setInputFocused,
  inputMultiline,
  composerMenuOpen,
  setComposerMenuOpen,
  composerMenuRef,
  chatMode,
  setChatMode,
  activeSavedAgentId,
  setActiveSavedAgentId,
  textareaRef,
}: ComposerProps) {
  const {
    status,
    chatError,
    clearError,
    regenerate,
    planQuestions,
    planReady,
    approvalPending,
    approvalError,
    handlePlanWizardSubmit,
    handlePlanSkipToPlan,
    handlePlanApprove,
    handlePlanEdit,
    handlePlanCancel,
    handleSubmit,
    handleKeyDown,
    handleInput,
    addAttachments,
    focusComposer,
  } = useChatRuntime();
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
  } = useWorkspace();

  return (
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

        {planQuestions && status === "ready" && (
          <div style={{ marginBottom: 10 }}>
            <PlanWizard questions={planQuestions} onSubmit={handlePlanWizardSubmit} onSkip={handlePlanSkipToPlan} />
          </div>
        )}

        {planReady && status === "ready" && (
          <div style={{ marginBottom: 10 }}>
            <div className="plan-card" role="group" aria-label="Plan ready">
              <div className="plan-card-head">
                <ListChecks className="w-4 h-4" />
                <span className="plan-card-title">Plan ready</span>
              </div>
              <p className="plan-card-desc">Review the plan above, then choose how to proceed.</p>
              {approvalError && (
                <p className="plan-card-desc" style={{ color: "var(--accent-secondary)" }}>
                  {approvalError}
                </p>
              )}
              <div className="plan-card-actions">
                <button
                  type="button"
                  className="plan-btn run"
                  disabled={approvalPending}
                  onClick={() => void handlePlanApprove()}
                >
                  <Play className="w-3.5 h-3.5" /> {approvalPending ? "Approving…" : "Approve"}
                </button>
                <button type="button" className="plan-btn adjust" disabled={approvalPending} onClick={handlePlanEdit}>
                  <PenLine className="w-3.5 h-3.5" /> Edit
                </button>
                <button type="button" className="plan-btn cancel" disabled={approvalPending} onClick={handlePlanCancel}>
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
  );
}
