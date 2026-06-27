export type AioChatMode = "auto" | "plan" | "research";

export interface AioResearchSummary {
  status: "completed" | "interrupted";
  searchCount: number;
  toolCount: number;
}

export function normalizeAioChatMode(value: unknown, legacyPlanMode = false): AioChatMode {
  if (value === "auto" || value === "plan" || value === "research") return value;
  return legacyPlanMode ? "plan" : "auto";
}
