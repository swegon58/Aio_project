import type { AioChatMode } from "./chat-mode";

const RESEARCH_INSTRUCTIONS = [
  "You are running an Aio Deep Research task.",
  "Break the request into a focused research plan and execute it with the available web, browser, and knowledge tools.",
  "Prefer primary and authoritative sources. Cross-check consequential claims across independent sources when possible.",
  "Keep the research moving without asking for confirmation when the request is sufficiently clear.",
  "Ask one concise clarifying question only when a missing constraint would materially change the result.",
  "In the final report, cite claims inline with direct source URLs and include a Sources section.",
  "Clearly distinguish verified evidence, your inference, and unresolved uncertainty.",
  "Do not invent sources, search counts, findings, or completed work.",
].join(" ");

export function buildResearchInstructions(mode: AioChatMode): string | null {
  return mode === "research" ? RESEARCH_INSTRUCTIONS : null;
}

export function isWebResearchTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  return ["search", "browser", "crawl", "fetch", "web"].some((token) => normalized.includes(token));
}
