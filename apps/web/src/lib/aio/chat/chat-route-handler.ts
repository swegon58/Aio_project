import { convertToModelMessages, type UIMessage } from "ai";
import type { NextRequest } from "next/server";
import { normalizeAioChatMode, type AioChatMode } from "./chat-mode";

export interface AioChatRequestPayload {
  messages: UIMessage[];
  mode: AioChatMode;
  planMode: boolean;
  savedAgentId: string | null;
}

export interface AioRuntimeMessage {
  role: string;
  content: string;
}

export async function readAioChatRequest(req: NextRequest): Promise<AioChatRequestPayload> {
  const body = await req.json();
  const mode = normalizeAioChatMode(body.mode, Boolean(body.planMode));
  return {
    messages: body.messages ?? [],
    mode,
    planMode: mode === "plan",
    savedAgentId: typeof body.savedAgentId === "string" ? body.savedAgentId : null,
  };
}

export async function buildRuntimeMessages(messages: UIMessage[]) {
  const modelMessages = await convertToModelMessages(messages);
  const runtimeMessages = modelMessages.map((msg) => ({
    role: msg.role,
    content: Array.isArray(msg.content)
      ? msg.content
          .filter((part) => part.type === "text")
          .map((part) => (part as { text: string }).text)
          .join("")
      : String(msg.content),
  }));

  const lastMessage = runtimeMessages[runtimeMessages.length - 1];
  const conversationHistory = runtimeMessages.slice(0, -1);

  return { runtimeMessages, lastMessage, conversationHistory };
}
