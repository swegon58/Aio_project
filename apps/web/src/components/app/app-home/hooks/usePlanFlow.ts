import { useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { HermesActivityData, HermesApprovalData, HermesShowcaseData } from "@/lib/hermes/chat-types";
import { parsePlanQuestion } from "@/components/app/app-home-utils";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";

interface UsePlanFlowParams {
  status: "submitted" | "streaming" | "ready" | "error";
  sendMessage: (message: { text: string }, options: { body: { mode: AioChatMode } }) => void;
  setActivity: Dispatch<SetStateAction<HermesActivityData[]>>;
  primeOptimisticRun: () => void;
  setShowcases: Dispatch<SetStateAction<HermesShowcaseData[]>>;
  setPendingApproval: Dispatch<SetStateAction<Extract<HermesApprovalData, { kind: "request" }> | null>>;
  setChatMode: Dispatch<SetStateAction<AioChatMode>>;
  setLastRunMode: Dispatch<SetStateAction<AioChatMode>>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  hasText: boolean;
  lastAssistantText: string;
}

// Plan-mode gate (multi-round clarifying questions, then run/adjust/cancel
// on the final plan card), extracted verbatim from AppHome.tsx. Depends on
// the shell's chat surface (status/sendMessage) and run-reset helpers, which
// aren't owned here, so they're passed in as explicit args.
export function usePlanFlow({
  status,
  sendMessage,
  setActivity,
  primeOptimisticRun,
  setShowcases,
  setPendingApproval,
  setChatMode,
  setLastRunMode,
  textareaRef,
  hasText,
  lastAssistantText,
}: UsePlanFlowParams) {
  const [planAwaitingAction, setPlanAwaitingAction] = useState(false);
  const [planOtherText, setPlanOtherText] = useState("");

  const handlePlanRun = () => {
    if (status !== "ready") return;
    setPlanAwaitingAction(false);
    setChatMode("auto");
    setLastRunMode("auto");
    setActivity([]);
    primeOptimisticRun();
    setShowcases([]);
    setPendingApproval(null);
    sendMessage(
      { text: "Proceed with the plan above, step by step." },
      { body: { mode: "auto" } },
    );
  };
  const handlePlanAdjust = () => {
    setPlanAwaitingAction(false);
    textareaRef.current?.focus();
  };
  const handlePlanCancel = () => {
    setPlanAwaitingAction(false);
    setChatMode("auto");
  };

  const handlePlanAnswer = (answer: string) => {
    if (status !== "ready" || !answer.trim()) return;
    setActivity([]);
    primeOptimisticRun();
    setShowcases([]);
    setPendingApproval(null);
    setPlanOtherText("");
    setPlanAwaitingAction(true);
    setLastRunMode("plan");
    sendMessage({ text: answer.trim() }, { body: { mode: "plan" } });
  };
  const handlePlanSkipToPlan = () =>
    handlePlanAnswer("Skip the remaining questions and write the final plan now, using your best judgment for anything still unclear.");

  const planQuestion = useMemo(
    () => (planAwaitingAction && hasText ? parsePlanQuestion(lastAssistantText) : null),
    [planAwaitingAction, hasText, lastAssistantText],
  );

  return {
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
}
