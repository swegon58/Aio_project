import type { UIMessage } from "ai";
import { scanAndCleanInput } from "@/lib/security/threat-patterns";
import { recordThreatHitAndCheckBlock } from "./abuse-guard";

export function scanAioInputMessages(
  messages: UIMessage[],
  context: { userId: string; threadId: string },
): { shouldBlock: boolean } {
  let shouldBlock = false;

  for (const msg of messages) {
    for (const part of msg.parts ?? []) {
      if (part.type !== "text") continue;
      const { cleaned, strippedInvisibleUnicode, matchedPatternIds } = scanAndCleanInput(part.text);
      if (strippedInvisibleUnicode) part.text = cleaned;
      if (matchedPatternIds.length > 0) {
        console.warn(
          `[threat-scan] userId=${context.userId} threadId=${context.threadId} patterns=${matchedPatternIds.join(",")}`,
        );
        if (recordThreatHitAndCheckBlock(context.userId)) shouldBlock = true;
      }
    }
  }

  return { shouldBlock };
}
