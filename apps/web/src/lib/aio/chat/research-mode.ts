import type { AioChatMode } from "./chat-mode";

// R13.3 item 4 — minimum distinct sources required before synthesis. 4 sits
// in the middle of the 3-5 range implied by competitor Deep Research modes:
// enough to force real cross-checking on a multi-part question, not so many
// it turns every simple query into a latency/cost outlier. Only a floor for
// the source count already tracked in run-orchestrator's `researchSourceIds`
// — never a hard blocker, since there is no clean interception point to
// reject an in-flight model response (see run-orchestrator.ts comment at the
// message.delta handler).
export const MIN_RESEARCH_SOURCES = 4;

const RESEARCH_INSTRUCTIONS = [
  "You are running an Aio Deep Research task.",
  "Break the request into a focused research plan and execute it with the available web, browser, and knowledge tools.",
  "Prefer primary and authoritative sources. Cross-check consequential claims across independent sources when possible.",
  `Non-negotiable minimum depth: consult at least ${MIN_RESEARCH_SOURCES} distinct sources before writing your final synthesis or report. Do not move to synthesis after only one or two searches. If the topic is narrow enough that fewer credible sources genuinely exist, say so explicitly in the report instead of silently skipping this minimum.`,
  "Keep the research moving without asking for confirmation when the request is sufficiently clear.",
  "Ask one concise clarifying question only when a missing constraint would materially change the result.",
  "In the final report, include a numbered Sources list (each source on its own line as: [N] <URL>) and cite claims inline as [N] pointing at that list, one citation per discrete claim.",
  "Never cite a source that is not in the Sources list, and never add a source to the list that you did not actually retrieve during research.",
  "Clearly distinguish verified evidence, your inference, and unresolved uncertainty.",
  "Do not invent sources, search counts, findings, or completed work.",
].join(" ");

// R13.4 — research mode now gates on an explicit user confirmation before
// running any tools, mirroring plan-mode.ts's PLAN_MODE_INSTRUCTIONS exactly
// (same prompt-level gate, same trust level as the rest of this codebase's
// guardrails — not a new mechanism).
export const RESEARCH_PLAN_INSTRUCTIONS = [
  "Research mode plan phase is ON for this turn. Do not call any tools, and do not start researching yet.",
  "Break the user's question into a short, question-specific research plan: a title and 3-6 concrete steps that reference the actual entities/topics named in the question (never generic boilerplate like plain \"search\" or \"read\").",
  'Reply with ONLY a single fenced code block tagged aio-research-plan containing strict JSON of this exact shape: {"title": "...", "steps": ["...", "..."]}. No prose before or after the block.',
  "Then stop and wait for confirmation before any research begins.",
].join(" ");

/** Sent by the frontend's "Start research" button (mirrors plan-mode.ts's SKIP_TO_PLAN_TEXT). */
export const RESEARCH_CONFIRM_TEXT = "Proceed with the research plan above, step by step.";

/**
 * Turn-aware research instructions (mirrors plan-mode.ts's buildPlanInstructions):
 * first research turn → plan-only instructions (no tools); once a plan has
 * already been produced in this conversation, or the user sent the confirm
 * trigger phrase, → the real execute-phase instructions (tools allowed).
 */
export function buildResearchInstructions(
  mode: AioChatMode,
  conversationHistory: { role: string; content: unknown }[],
  lastMessage: { role: string; content: unknown } | undefined,
): string | null {
  if (mode !== "research") return null;

  const planAlreadyProduced = conversationHistory.some(
    (msg) =>
      msg.role === "assistant" &&
      typeof msg.content === "string" &&
      msg.content.includes("```aio-research-plan"),
  );
  const userConfirmed =
    typeof lastMessage?.content === "string" && lastMessage.content.includes(RESEARCH_CONFIRM_TEXT);

  if (planAlreadyProduced || userConfirmed) {
    return RESEARCH_INSTRUCTIONS;
  }

  return RESEARCH_PLAN_INSTRUCTIONS;
}

export function isWebResearchTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  return ["search", "browser", "crawl", "fetch", "web"].some((token) => normalized.includes(token));
}
