import { convertToModelMessages, type UIMessage } from "ai";
import type { NextRequest } from "next/server";

export interface AioChatRequestPayload {
  messages: UIMessage[];
  planMode: boolean;
}

export interface AioRuntimeMessage {
  role: string;
  content: string;
}

export async function readAioChatRequest(req: NextRequest): Promise<AioChatRequestPayload> {
  const body = await req.json();
  return {
    messages: body.messages ?? [],
    planMode: Boolean(body.planMode),
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
