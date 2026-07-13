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

// R16 A2 — do NOT tell the model to use delegate_task/background subagents
// here. hermes-agent forces every top-level (depth 0) delegate_task call
// into background mode (tools/delegate_tool.py _model_background_value,
// run_agent.py _dispatch_delegate_task: `background=(not is_subagent)`),
// delivered by re-injecting a message on the platform adapter once the
// subagent finishes (gateway/run.py _async_delegation_watcher ->
// adapter.handle_message). Aio's web chat runs on APIServerAdapter, whose
// send() is a permanent no-op stub (gateway/platforms/api_server.py) — so a
// background delegation would finish with nowhere to deliver its result,
// silently dropping it (no REST polling path exists either). Until
// hermes-agent ships a delivery channel for the API_SERVER adapter (or a
// synchronous top-level delegate mode), keep research sequential.
const RESEARCH_INSTRUCTIONS = [
  "You are running an Aio Deep Research task.",
  "Break the request into a focused research plan and execute it with the available web, browser, and knowledge tools.",
  "Do not use delegate_task or spawn background sub-agents for this research — run every step yourself in this conversation; background delegation results cannot be delivered back to this chat.",
  "For academic, scientific, or technical topics, also use the arxiv skill to search and cite arXiv papers as a primary source.",
  "Prefer primary and authoritative sources. Cross-check consequential claims across independent sources when possible.",
  `Non-negotiable minimum depth: consult at least ${MIN_RESEARCH_SOURCES} distinct sources before writing your final synthesis or report. Do not move to synthesis after only one or two searches. If the topic is narrow enough that fewer credible sources genuinely exist, say so explicitly in the report instead of silently skipping this minimum.`,
  "Before writing your final report, you MUST call the research_complete tool with the distinct source URLs you retrieved and a short summary of what you found. If it returns ok:false, you have not met the minimum source depth — keep researching and call it again before writing anything. Only start the final report after research_complete returns ok:true.",
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

// R15 C2 — batch clarifying-questions phase, reusing plan-mode.ts's
// aio-questions block shape for consistency (shared wizard on the frontend).
// Runs before RESEARCH_PLAN_INSTRUCTIONS: ask once, then move on to the plan.
export const RESEARCH_QUESTIONS_INSTRUCTIONS = [
  "Research mode is ON for this turn. Do not call any tools, and do not start researching yet.",
  'If the request is ambiguous and clarifying questions would meaningfully change the research, ask ALL of them in a single turn: respond with ONLY a single fenced code block tagged aio-questions containing strict JSON of this exact shape: {"questions": [{"question": "...", "choices": ["...", "...", "..."], "recommended": "..."}, ...]} — between 2 and 5 questions total, each with exactly 3 short, concrete choices, and "recommended" set to the exact text of the choice you\'d pick for that question. Output nothing else in that turn: no prose before or after the block.',
  "Once you've asked your batch of clarifying questions, or the user's message says to skip ahead, produce the research plan (a single aio-research-plan block) on your next turn instead — do not ask another aio-questions block.",
].join(" ");

/** Sent by the frontend's "Start research" button (mirrors plan-mode.ts's SKIP_TO_PLAN_TEXT). */
export const RESEARCH_CONFIRM_TEXT = "Proceed with the research plan above, step by step.";

// R16 A7 — sent by the Workspace report panel's "Export as Word doc" button
// on a finished research report. Unlike the Markdown/PDF export buttons
// (client-only, see reportFileBaseName/buildReportHtmlDocument in
// app-home-utils.ts), this is agent-driven: the model already has the report
// in this thread's context and uses the `docx` skill (aio-home/profiles/aio/
// skills/productivity/docx) to author a real .docx via write_file. The
// resulting file surfaces automatically as a downloadable message artifact —
// api_server.py's `_extract_artifact_path` already matches `.docx` in
// `_ARTIFACT_EXTENSIONS`, no new backend plumbing needed for the download
// itself. Sent with mode "auto" (not the current chat mode) since this is a
// one-off action on an already-finished report, not a new research query.
export const EXPORT_DOCX_INSTRUCTION =
  "Export the research report above as a polished Word document (.docx) using the docx skill, then confirm the saved file path.";

/** Skip straight to the research plan, mirroring plan-mode.ts's SKIP_TO_PLAN_TEXT. */
const RESEARCH_SKIP_QUESTIONS_TEXT = "Skip the clarifying questions and write the research plan now";

/**
 * Turn-aware research instructions (mirrors plan-mode.ts's buildPlanInstructions):
 * first research turn → batch clarifying questions; once asked (or skipped)
 * → plan-only instructions (no tools); once a plan has already been produced
 * in this conversation, or the user sent the confirm trigger phrase → the
 * real execute-phase instructions (tools allowed).
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

  const questionsAlreadyAsked = conversationHistory.some(
    (msg) => msg.role === "assistant" && typeof msg.content === "string" && msg.content.includes("```aio-questions"),
  );
  const userSkippedQuestions =
    typeof lastMessage?.content === "string" && lastMessage.content.includes(RESEARCH_SKIP_QUESTIONS_TEXT);

  if (questionsAlreadyAsked || userSkippedQuestions) {
    return RESEARCH_PLAN_INSTRUCTIONS;
  }

  return RESEARCH_QUESTIONS_INSTRUCTIONS;
}

export function isWebResearchTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  return ["search", "browser", "crawl", "fetch", "web"].some((token) => normalized.includes(token));
}

function normalizeSourceUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

// R15 gap 3A — the model's own Sources list / [N] citations are self-reported
// and can drift from what was actually retrieved (run-orchestrator's
// `researchSourceIds`, populated only from real tool.completed URLs). Strip
// the citation marker for any [N] whose Sources-list URL isn't in the real,
// server-observed set, rather than flagging it or blocking synthesis — the
// underlying prose claim stays, only the false "this is sourced" marker goes.
export function stripUngroundedCitations(text: string, groundedUrls: Iterable<string>): string {
  const grounded = new Set(Array.from(groundedUrls, normalizeSourceUrlKey));
  const sourceLineRe = /^\[(\d+)\]\s+(\S+)\s*$/gm;
  const ungroundedIds = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = sourceLineRe.exec(text))) {
    const [, id, url] = match;
    if (!grounded.has(normalizeSourceUrlKey(url))) ungroundedIds.add(id);
  }
  if (ungroundedIds.size === 0) return text;

  let result = text.replace(/^\[(\d+)\]\s+\S+\s*$/gm, (line, id) => (ungroundedIds.has(id) ? "" : line));
  for (const id of ungroundedIds) {
    result = result.replace(new RegExp(`\\[${id}\\]`, "g"), "");
  }
  return result.replace(/\n{3,}/g, "\n\n");
}
