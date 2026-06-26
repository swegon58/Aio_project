import type { HermesRunEvent } from "./hermes-event-types";

export function parseHermesSseDataLine(line: string): HermesRunEvent | null {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith(":")) return null;
  if (!trimmed.startsWith("data:")) return null;

  const payload = trimmed.slice(5).trim();
  if (payload === "[DONE]") return null;

  try {
    return JSON.parse(payload) as HermesRunEvent;
  } catch {
    return null;
  }
}
