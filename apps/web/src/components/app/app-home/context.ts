import { createContext, useContext } from "react";
import type { useChat } from "@ai-sdk/react";
import type { HermesUIMessage } from "@/lib/hermes/chat-types";
import type { useChatComposer } from "@/components/app/app-home/hooks/useChatComposer";
import type { useRunTimeline } from "@/components/app/app-home/hooks/useRunTimeline";
import type { usePlanFlow } from "@/components/app/app-home/hooks/usePlanFlow";
import type { useWorkspacePanel } from "@/components/app/app-home/hooks/useWorkspacePanel";
import type { useImageGeneration } from "@/components/app/app-home/hooks/useImageGeneration";
import type { useConversations } from "@/components/app/app-home/hooks/useConversations";
import type { useConnections } from "@/components/app/app-home/hooks/useConnections";
import type { useCredentials } from "@/components/app/app-home/hooks/useCredentials";
import type { useCronJobs } from "@/components/app/app-home/hooks/useCronJobs";
import type { useNotifications } from "@/components/app/app-home/hooks/useNotifications";
import type { useAccountPrefs } from "@/components/app/app-home/hooks/useAccountPrefs";

type UseChatReturn = ReturnType<typeof useChat<HermesUIMessage>>;

// HOT (per-token): useChat surface + composer + run timeline + plan flow.
export interface ChatRuntimeContextValue
  extends Pick<UseChatReturn, "messages" | "sendMessage" | "status" | "setMessages" | "stop" | "regenerate" | "clearError">,
    ReturnType<typeof useChatComposer>,
    Pick<
      ReturnType<typeof useRunTimeline>,
      | "activeRunId"
      | "runEvents"
      | "persistedRunStatus"
      | "timelineHydrating"
      | "timelineSyncError"
      | "runStopPending"
      | "runStopError"
      | "resetRunTimeline"
      | "primeOptimisticRun"
      | "ingestDataPart"
      | "handleDurableRunStop"
    >,
    ReturnType<typeof usePlanFlow> {
  chatError: UseChatReturn["error"];
}

// WARM (on navigation): workspace panel + image generation.
export interface WorkspaceContextValue
  extends Pick<
      ReturnType<typeof useWorkspacePanel>,
      | "filesSubTab"
      | "setFilesSubTab"
      | "metaLog"
      | "logMeta"
      | "terminalOpen"
      | "terminalTab"
      | "setTerminalTab"
      | "cycleTerminal"
      | "memorySnapshot"
      | "galleryImages"
      | "setGalleryImages"
      | "galleryError"
      | "galleryUploading"
      | "lightboxImage"
      | "setLightboxImage"
      | "galleryFileInputRef"
      | "fileTreePath"
      | "fileTreeEntries"
      | "setFileTreeEntries"
      | "fileTreeError"
      | "fileTreeLoading"
      | "loadFileTree"
      | "handleGalleryFileSelected"
      | "handleGalleryDelete"
    >,
    Pick<
      ReturnType<typeof useImageGeneration>,
      | "imageComposerActive"
      | "setImageComposerActive"
      | "imageAspectRatio"
      | "setImageAspectRatio"
      | "imageResolution"
      | "setImageResolution"
      | "imageReference"
      | "setImageReference"
      | "imageGenerationStatus"
      | "imageGenerationError"
      | "setImageGenerationError"
      | "imageLastPrompt"
      | "activateImageComposer"
      | "handleGeneratedImageOpen"
      | "handleGeneratedImageEdit"
      | "handleGeneratedImageVariation"
      | "cancelImageGeneration"
      | "submitImageGeneration"
    > {}

// COLD (modal/sidebar actions): conversations, connections, credentials, cron, notifications, prefs.
export interface AccountDataContextValue
  extends Pick<
      ReturnType<typeof useConversations>,
      | "conversations"
      | "conversationsError"
      | "activeConversationId"
      | "setActiveConversationId"
      | "renamingConversationId"
      | "setRenamingConversationId"
      | "renameValue"
      | "setRenameValue"
      | "loadConversations"
      | "handleNewChat"
      | "handleLoadConversation"
      | "handleDeleteConversation"
      | "handleStartRename"
      | "handleRenameConversation"
    >,
    ReturnType<typeof useConnections>,
    ReturnType<typeof useCredentials>,
    Pick<
      ReturnType<typeof useCronJobs>,
      | "cronJobs"
      | "cronError"
      | "cronLocked"
      | "cronActionPending"
      | "cronName"
      | "setCronName"
      | "cronSchedule"
      | "setCronSchedule"
      | "cronPrompt"
      | "setCronPrompt"
      | "cronNotifyDiscord"
      | "setCronNotifyDiscord"
      | "cronCreating"
      | "cronCreateMessage"
      | "handleCronAction"
      | "handleCronDelete"
      | "handleCronCreate"
    >,
    ReturnType<typeof useNotifications>,
    Pick<
      ReturnType<typeof useAccountPrefs>,
      | "theme"
      | "setTheme"
      | "accent"
      | "setAccent"
      | "font"
      | "setFont"
      | "onboardedAt"
      | "setOnboardedAt"
      | "exportLoading"
      | "exportStatus"
      | "handleExportData"
      | "deleteLoading"
      | "deleteStatus"
      | "handleDeleteAccount"
    > {}

export const ChatRuntimeContext = createContext<ChatRuntimeContextValue | null>(null);
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export const AccountDataContext = createContext<AccountDataContextValue | null>(null);

export function useChatRuntime(): ChatRuntimeContextValue {
  const ctx = useContext(ChatRuntimeContext);
  if (!ctx) throw new Error("useChatRuntime must be used within AppHomeProviders");
  return ctx;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within AppHomeProviders");
  return ctx;
}

export function useAccountData(): AccountDataContextValue {
  const ctx = useContext(AccountDataContext);
  if (!ctx) throw new Error("useAccountData must be used within AppHomeProviders");
  return ctx;
}
