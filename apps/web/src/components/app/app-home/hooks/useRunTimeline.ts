import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { DataUIPart } from "ai";
import {
  fetchConversationRuns,
  fetchRun,
  fetchRunEvents,
  isRunStoppable,
  isRunTerminal,
  requestRunStop,
} from "@/lib/aio/runs/run-client";
import type { AioRunEvent, AioRunStatus } from "@/lib/aio/runs/aio-run-events";
import type {
  HermesActivityData,
  HermesApprovalData,
  HermesCreditsData,
  HermesDataTypes,
  HermesShowcaseData,
} from "@/lib/hermes/chat-types";
import { isPendingRunShellEvent, mergeDurableRunEvents, pendingApprovalFromRunEvents } from "@/components/app/app-home-utils";

interface UseRunTimelineParams {
  chatStatus: "submitted" | "streaming" | "ready" | "error";
  stop: () => void;
  activeConversationId: string | null;
  setActiveConversationId: Dispatch<SetStateAction<string | null>>;
  isMobileViewport: boolean;
  setRightPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  setActivity: Dispatch<SetStateAction<HermesActivityData[]>>;
  setShowcases: Dispatch<SetStateAction<HermesShowcaseData[]>>;
  setOpenShowcase: Dispatch<SetStateAction<HermesShowcaseData | null>>;
  setPendingApproval: Dispatch<SetStateAction<Extract<HermesApprovalData, { kind: "request" }> | null>>;
  setCreditBalance: Dispatch<SetStateAction<number | null>>;
  setCreditUsage: Dispatch<SetStateAction<HermesCreditsData | null>>;
  setIsCompressing: Dispatch<SetStateAction<boolean>>;
}

// Durable run timeline (activeRunId/runEvents/persisted status + hydration on
// conversation switch + 3s poll while a run is in flight + approval
// derivation), extracted verbatim from AppHome.tsx. `ingestDataPart` is the
// former inline useChat({ onData }) body — kept here since it mutates the
// same state as the rest of this domain.
export function useRunTimeline({
  chatStatus,
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
}: UseRunTimelineParams) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runEvents, setRunEvents] = useState<AioRunEvent[]>([]);
  const [persistedRunStatus, setPersistedRunStatus] = useState<AioRunStatus | null>(null);
  const [persistedEventSequence, setPersistedEventSequence] = useState(-1);
  const [timelineHydrating, setTimelineHydrating] = useState(false);
  const [timelineSyncError, setTimelineSyncError] = useState<string | null>(null);
  const [runStopPending, setRunStopPending] = useState(false);
  const [runStopError, setRunStopError] = useState<string | null>(null);

  const resetRunTimeline = () => {
    setActiveRunId(null);
    setRunEvents([]);
    setPersistedRunStatus(null);
    setPersistedEventSequence(-1);
    setTimelineSyncError(null);
    setRunStopPending(false);
    setRunStopError(null);
  };

  const primeOptimisticRun = () => {
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    setActiveRunId(null);
    setPersistedRunStatus("queued");
    setPersistedEventSequence(-1);
    setTimelineSyncError(null);
    setRunStopPending(false);
    setRunStopError(null);
    setRunEvents([
      {
        type: "run.created",
        runId: `pending:${now}`,
        threadId: activeConversationId ?? "pending-thread",
        status: "queued",
        createdAt,
        ts: now,
      },
    ]);
  };

  const ingestDataPart = (dataPart: DataUIPart<HermesDataTypes>) => {
    if (dataPart.type === "data-aio-event") {
      setRunEvents((prev) => mergeDurableRunEvents(prev, [dataPart.data]));
      if (dataPart.data.type === "run.created") setPersistedRunStatus(dataPart.data.status);
      if (dataPart.data.type === "approval.requested") setPersistedRunStatus("waiting_approval");
      if (dataPart.data.type === "run.completed") setPersistedRunStatus("completed");
      if (dataPart.data.type === "run.failed") setPersistedRunStatus("failed");
      if (dataPart.data.type === "run.cancelled") setPersistedRunStatus("cancelled");
      return;
    }
    if (dataPart.type === "data-aio-run" || dataPart.type === "data-hermes-run") {
      // Brand-new chat (sent before "New Chat" was ever clicked, so
      // activeConversationId is still null) — capture the server-assigned
      // thread id now, otherwise the reload-restore effect has no id to
      // look up and the whole turn vanishes on refresh.
      setActiveConversationId((prev) => prev ?? dataPart.data.threadId);
      setActiveRunId(dataPart.data.runId);
      setTimelineSyncError(null);
      setRunEvents((prev) => prev.filter((event) => !isPendingRunShellEvent(event)));
      return;
    }
    if (dataPart.type === "data-aio-credits" || dataPart.type === "data-hermes-credits") {
      setCreditBalance(dataPart.data.balance);
      setCreditUsage(dataPart.data);
      return;
    }
    if (dataPart.type === "data-aio-compression" || dataPart.type === "data-hermes-compression") {
      setIsCompressing(dataPart.data.active);
      return;
    }
    if (dataPart.type === "data-aio-approval" || dataPart.type === "data-hermes-approval") {
      const incoming = dataPart.data;
      if (incoming.kind === "request") {
        setPendingApproval(incoming);
      } else {
        setPendingApproval((prev) => (prev?.requestId === incoming.requestId ? null : prev));
      }
      return;
    }
    if (dataPart.type === "data-aio-showcase" || dataPart.type === "data-hermes-showcase") {
      const incoming = dataPart.data;
      setShowcases((prev) => {
        const index = prev.findIndex((item) => item.taskId === incoming.taskId);
        if (index === -1) return [...prev, incoming];
        const next = [...prev];
        next[index] = incoming;
        return next;
      });
      // Q4: auto-switch the right panel to follow the task live, not just
      // on chip click (chip itself stays disabled while running — Q8).
      setOpenShowcase(incoming);
      if (!isMobileViewport) setRightPanelCollapsed(false);
      return;
    }
    if (dataPart.type !== "data-aio-activity" && dataPart.type !== "data-hermes-activity") return;
    const incoming = dataPart.data;
    setActivity((prev) => {
      if (incoming.kind === "tool") {
        const index = prev.findIndex((item) => item.kind === "tool" && item.toolCallId === incoming.toolCallId);
        if (index === -1) return [...prev, incoming];
        const next = [...prev];
        next[index] = incoming;
        return next;
      }
      return [...prev, incoming];
    });
  };

  const handleDurableRunStop = async () => {
    if (!activeRunId || !persistedRunStatus || !isRunStoppable(persistedRunStatus) || runStopPending) return;
    setRunStopPending(true);
    setRunStopError(null);
    try {
      const result = await requestRunStop(activeRunId);
      setPersistedRunStatus(result.run.status);
      if (chatStatus !== "ready") void stop();
      if (result.message && !result.ok) {
        setRunStopError(result.message);
      }
    } catch (error) {
      setRunStopError(error instanceof Error ? error.message : "Failed to stop the current run.");
    } finally {
      setRunStopPending(false);
    }
  };

  useEffect(() => {
    if (!activeConversationId || chatStatus === "submitted" || chatStatus === "streaming") return;

    let cancelled = false;
    setTimelineHydrating(true);
    setTimelineSyncError(null);

    (async () => {
      try {
        const runs = await fetchConversationRuns(activeConversationId, 1);
        if (cancelled) return;

        const latestRun = runs[0];
        if (!latestRun) {
          setActiveRunId(null);
          setPersistedRunStatus(null);
          setPersistedEventSequence(-1);
          setRunEvents([]);
          return;
        }

        setActiveRunId(latestRun.id);
        setPersistedRunStatus(latestRun.status);

        const envelopes = await fetchRunEvents(latestRun.id, { limit: 1000 });
        if (cancelled) return;

        setPersistedEventSequence(
          envelopes.length > 0 ? envelopes[envelopes.length - 1].sequence : -1,
        );
        setRunEvents((prev) =>
          mergeDurableRunEvents(
            prev,
            envelopes.map((event) => event.payload),
          ),
        );
      } catch {
        if (!cancelled) {
          setTimelineSyncError("Could not restore the latest saved run. Try re-opening this conversation.");
        }
      } finally {
        if (!cancelled) setTimelineHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, chatStatus]);

  useEffect(() => {
    if (
      !activeRunId ||
      !persistedRunStatus ||
      isRunTerminal(persistedRunStatus) ||
      chatStatus === "submitted" ||
      chatStatus === "streaming" ||
      timelineHydrating
    ) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const [run, envelopes] = await Promise.all([
          fetchRun(activeRunId),
          fetchRunEvents(activeRunId, {
            afterSequence: persistedEventSequence >= 0 ? persistedEventSequence : undefined,
            limit: 1000,
          }),
        ]);
        if (cancelled) return;

        setPersistedRunStatus(run.status);
        setTimelineSyncError(null);
        if (envelopes.length > 0) {
          setPersistedEventSequence(envelopes[envelopes.length - 1].sequence);
          setRunEvents((prev) =>
            mergeDurableRunEvents(
              prev,
              envelopes.map((event) => event.payload),
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setTimelineSyncError("Live updates disconnected. Aio is retrying the saved timeline automatically.");
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRunId, persistedEventSequence, persistedRunStatus, chatStatus, timelineHydrating]);

  useEffect(() => {
    if (chatStatus === "submitted" || chatStatus === "streaming") return;
    const durableEvents = runEvents.filter((event) => !isPendingRunShellEvent(event));
    if (durableEvents.length === 0) return;
    setPendingApproval(pendingApprovalFromRunEvents(durableEvents));
  }, [runEvents, chatStatus]);

  useEffect(() => {
    if (chatStatus !== "ready" || activeRunId) return;
    if (!runEvents.some((event) => isPendingRunShellEvent(event))) return;
    setRunEvents((prev) => prev.filter((event) => !isPendingRunShellEvent(event)));
    setPersistedRunStatus(null);
  }, [activeRunId, runEvents, chatStatus]);

  return {
    activeRunId,
    runEvents,
    persistedRunStatus,
    persistedEventSequence,
    timelineHydrating,
    timelineSyncError,
    runStopPending,
    runStopError,
    resetRunTimeline,
    primeOptimisticRun,
    ingestDataPart,
    handleDurableRunStop,
  };
}
