import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { HermesActivityData, HermesApprovalData, HermesShowcaseData, HermesUIMessage } from "@/lib/hermes/chat-types";
import type { ConversationSummary } from "@/components/app/app-home-types";
import { friendlyFetchError } from "@/lib/aio/friendly-fetch-error";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";

interface UseConversationsParams {
  status: "submitted" | "streaming" | "ready" | "error";
  setMessages: (messages: HermesUIMessage[]) => void;
  setActivity: Dispatch<SetStateAction<HermesActivityData[]>>;
  resetRunTimeline: () => void;
  setShowcases: Dispatch<SetStateAction<HermesShowcaseData[]>>;
  setPendingApproval: Dispatch<SetStateAction<Extract<HermesApprovalData, { kind: "request" }> | null>>;
  setPlanAwaitingAction: Dispatch<SetStateAction<boolean>>;
  setChatMode: Dispatch<SetStateAction<AioChatMode>>;
  setLastRunMode: Dispatch<SetStateAction<AioChatMode>>;
  setActiveResearchQuery: Dispatch<SetStateAction<string>>;
  logMeta: (text: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: Dispatch<SetStateAction<string | null>>;
  confirmDeleteTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
}

// Conversation list + active-conversation lifecycle (load, create, switch,
// delete, rename, refresh-restore), extracted verbatim from AppHome.tsx.
// applyConversationData also resets the plan/run/showcase state that a
// conversation switch invalidates, so those setters are passed in as args.
export function useConversations({
  status,
  setMessages,
  setActivity,
  resetRunTimeline,
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
}: UseConversationsParams) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const loadConversationRequestRef = useRef<string | null>(null);

  const loadConversations = async () => {
    setConversationsError(null);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      setConversations(data.conversations);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Refresh the sidebar list once a turn finishes (creates the row, or
  // bumps updated_at / sets the title for the first time).
  useEffect(() => {
    if (status === "ready") loadConversations();
  }, [status]);

  // Shared by the sidebar click handler and the refresh-restore effect below
  // — derives planAwaitingAction straight from the last loaded message's
  // metadata instead of relying on transient session state.
  const applyConversationData = (data: { id: string; messages: HermesUIMessage[] }) => {
    setActiveConversationId(data.id);
    setMessages(data.messages ?? []);
    setActivity([]);
    resetRunTimeline();
    setShowcases([]);
    setPendingApproval(null);
    const last = data.messages?.[data.messages.length - 1];
    const lastMode = last?.metadata?.mode ?? (last?.metadata?.planMode ? "plan" : "auto");
    const awaitingPlan = Boolean(last?.role === "assistant" && lastMode === "plan");
    const latestUserMessage = data.messages?.findLast((message) => message.role === "user");
    const latestUserText = latestUserMessage?.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("") ?? "";
    setPlanAwaitingAction(awaitingPlan);
    // Keep the composer toggle in sync — otherwise a reload mid-plan-mode
    // leaves the question/plan card on screen while the toggle silently
    // reset to "auto", so the next typed answer sends planMode:false.
    setChatMode(lastMode);
    setLastRunMode(lastMode);
    setActiveResearchQuery(lastMode === "research" ? latestUserText : "");
  };

  // Restore the last-active conversation (and its Plan Mode card) on a hard
  // page refresh — activeConversationId otherwise resets to null on mount.
  useEffect(() => {
    const storedId = localStorage.getItem("aio-active-conversation");
    if (!storedId) return;
    loadConversationRequestRef.current = storedId;
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${storedId}`);
        if (!res.ok) throw new Error(friendlyFetchError(res.status));
        const data = await res.json();
        if (loadConversationRequestRef.current !== storedId) return;
        applyConversationData(data);
      } catch {
        if (loadConversationRequestRef.current === storedId) loadConversationRequestRef.current = null;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeConversationId) localStorage.setItem("aio-active-conversation", activeConversationId);
    else localStorage.removeItem("aio-active-conversation");
  }, [activeConversationId]);

  const handleNewChat = async () => {
    try {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      loadConversationRequestRef.current = data.id;
      setActiveConversationId(data.id);
      setMessages([]);
      setActivity([]);
      resetRunTimeline();
      setShowcases([]);
      setPendingApproval(null);
      setPlanAwaitingAction(false);
      setLastRunMode("auto");
      setActiveResearchQuery("");
      loadConversations();
      if (window.innerWidth <= 768) setSidebarCollapsed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
    }
  };

  const handleLoadConversation = async (id: string) => {
    if (id === activeConversationId) {
      if (window.innerWidth <= 768) setSidebarCollapsed(true);
      return;
    }
    loadConversationRequestRef.current = id;
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      const data = await res.json();
      if (loadConversationRequestRef.current !== id) return;
      applyConversationData(data);
      if (window.innerWidth <= 768) setSidebarCollapsed(true);
    } catch (err) {
      if (loadConversationRequestRef.current !== id) return;
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
      confirmDeleteTimeoutRef.current = setTimeout(() => setConfirmDeleteId((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    if (confirmDeleteTimeoutRef.current) clearTimeout(confirmDeleteTimeoutRef.current);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      setConversations((prev) => (prev ?? []).filter((c) => c.id !== id));
      logMeta("Deleted a conversation");
      if (id === activeConversationId) {
        loadConversationRequestRef.current = null;
        setActiveConversationId(null);
        setMessages([]);
        setActivity([]);
        resetRunTimeline();
        setShowcases([]);
        setPendingApproval(null);
        setPlanAwaitingAction(false);
        setLastRunMode("auto");
        setActiveResearchQuery("");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
    }
  };

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingConversationId(id);
    setRenameValue(currentTitle);
  };

  const handleRenameConversation = async (id: string) => {
    const title = renameValue.trim();
    setRenamingConversationId(null);
    if (!title) return;
    const prevTitle = conversations?.find((c) => c.id === id)?.title;
    if (title === prevTitle) return;
    setConversations((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(friendlyFetchError(res.status));
      logMeta(`Renamed a conversation to "${title}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConversationsError(msg);
      if (prevTitle !== undefined) {
        setConversations((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, title: prevTitle } : c)));
      }
    }
  };

  return {
    conversations,
    conversationsError,
    activeConversationId,
    setActiveConversationId,
    renamingConversationId,
    setRenamingConversationId,
    renameValue,
    setRenameValue,
    loadConversations,
    applyConversationData,
    handleNewChat,
    handleLoadConversation,
    handleDeleteConversation,
    handleStartRename,
    handleRenameConversation,
  };
}
