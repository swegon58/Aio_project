import { useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { HermesActivityData, HermesApprovalData, HermesShowcaseData } from "@/lib/hermes/chat-types";
import { parsePlanQuestions, parseResearchPlan } from "@/components/app/app-home-utils";
import { fetchRunApprovals, resolveRunApproval } from "@/lib/aio/runs/run-client";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import { RESEARCH_CONFIRM_TEXT } from "@/lib/aio/chat/research-mode";
import { isFinalPlanShape } from "@/lib/aio/chat/plan-mode";
import type { PlanWizardAnswer } from "@/components/app/app-home-types";

const SKIP_TO_PLAN_TEXT = "Skip the remaining questions and write the final plan now";
const RESEARCH_SKIP_TEXT = "Skip the clarifying questions and write the research plan now";
const PLAN_CONFIRM_TEXT = "Proceed with the plan above, step by step.";

interface UsePlanFlowParams {
  status: "submitted" | "streaming" | "ready" | "error";
  sendMessage: (
    message: { text: string; metadata?: { planWizardAnswers: PlanWizardAnswer[] } },
    options: { body: { mode: AioChatMode } },
  ) => void;
  setActivity: Dispatch<SetStateAction<HermesActivityData[]>>;
  primeOptimisticRun: () => void;
  setShowcases: Dispatch<SetStateAction<HermesShowcaseData[]>>;
  setPendingApproval: Dispatch<SetStateAction<Extract<HermesApprovalData, { kind: "request" }> | null>>;
  setChatMode: Dispatch<SetStateAction<AioChatMode>>;
  lastRunMode: AioChatMode;
  setLastRunMode: Dispatch<SetStateAction<AioChatMode>>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  hasText: boolean;
  lastAssistantText: string;
  planAwaitingAction: boolean;
  setPlanAwaitingAction: Dispatch<SetStateAction<boolean>>;
  activeRunId: string | null;
}

// Plan/research shared gate (R15 C): batch clarifying-questions wizard, then
// a single summary message, then Approve/Edit/Cancel over the durable
// aio_approvals gate (resolved via /api/runs/[runId]/approvals/[id]/resolve —
// the same route both modes' run-orchestrator gate checks server-side).
export function usePlanFlow({
  status,
  sendMessage,
  setActivity,
  primeOptimisticRun,
  setShowcases,
  setPendingApproval,
  setChatMode,
  lastRunMode,
  setLastRunMode,
  textareaRef,
  hasText,
  lastAssistantText,
  planAwaitingAction,
  setPlanAwaitingAction,
  activeRunId,
}: UsePlanFlowParams) {
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const resetTurnState = () => {
    setActivity([]);
    primeOptimisticRun();
    setShowcases([]);
    setPendingApproval(null);
  };

  const planQuestions = useMemo(
    () => (planAwaitingAction && hasText ? parsePlanQuestions(lastAssistantText) : null),
    [planAwaitingAction, hasText, lastAssistantText],
  );
  const researchPlan = useMemo(
    () => (planAwaitingAction && hasText ? parseResearchPlan(lastAssistantText) : null),
    [planAwaitingAction, hasText, lastAssistantText],
  );
  // "Plan ready" = the final numbered plan (plan mode) or a parsed
  // aio-research-plan block (research mode) — mirrors the positive shape
  // checks run-orchestrator.ts uses server-side before creating an approval,
  // so a malformed/refused model turn no longer shows Approve on garbage.
  const planReady =
    planAwaitingAction &&
    hasText &&
    !planQuestions &&
    (lastRunMode === "research" ? researchPlan !== null : isFinalPlanShape(lastAssistantText));

  const handlePlanWizardSubmit = (answers: PlanWizardAnswer[]) => {
    if (status !== "ready") return;
    resetTurnState();
    setApprovalError(null);
    setPlanAwaitingAction(true);
    const summary = answers.map((a, i) => `${i + 1}. ${a.question}\nAnswer: ${a.answer}`).join("\n\n");
    sendMessage({ text: summary, metadata: { planWizardAnswers: answers } }, { body: { mode: lastRunMode } });
  };

  const handlePlanSkipToPlan = () => {
    if (status !== "ready") return;
    resetTurnState();
    setApprovalError(null);
    setPlanAwaitingAction(true);
    sendMessage(
      { text: lastRunMode === "research" ? RESEARCH_SKIP_TEXT : SKIP_TO_PLAN_TEXT },
      { body: { mode: lastRunMode } },
    );
  };

  const handlePlanApprove = async () => {
    if (!activeRunId || approvalPending) return;
    setApprovalPending(true);
    setApprovalError(null);
    try {
      const approvals = await fetchRunApprovals(activeRunId);
      const pending = approvals.find((a) => a.status === "requested");
      if (!pending) throw new Error("Approval isn't ready yet — try again in a moment.");
      await resolveRunApproval(activeRunId, pending.aioApprovalId, "approve");
      setPlanAwaitingAction(false);
      resetTurnState();
      const sendMode = lastRunMode === "research" ? "research" : "auto";
      setChatMode(sendMode);
      setLastRunMode(sendMode);
      const confirmText = lastRunMode === "research" ? RESEARCH_CONFIRM_TEXT : PLAN_CONFIRM_TEXT;
      sendMessage({ text: confirmText }, { body: { mode: sendMode } });
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Failed to approve plan.");
    } finally {
      setApprovalPending(false);
    }
  };

  const handlePlanEdit = () => {
    setPlanAwaitingAction(false);
    textareaRef.current?.focus();
  };

  const handlePlanCancel = () => {
    setPlanAwaitingAction(false);
    setChatMode("auto");
  };

  return {
    planAwaitingAction,
    setPlanAwaitingAction,
    planQuestions,
    researchPlan,
    planReady,
    approvalPending,
    approvalError,
    handlePlanWizardSubmit,
    handlePlanSkipToPlan,
    handlePlanApprove,
    handlePlanEdit,
    handlePlanCancel,
  };
}
