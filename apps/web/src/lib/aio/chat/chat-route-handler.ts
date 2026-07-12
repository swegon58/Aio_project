import { convertToModelMessages, type UIMessage } from "ai";
import type { NextRequest } from "next/server";
import { normalizeAioChatMode, type AioChatMode } from "./chat-mode";

export interface AioChatRequestPayload {
  messages: UIMessage[];
  mode: AioChatMode;
  planMode: boolean;
  savedAgentId: string | null;
}

export type AioRuntimeContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface AioRuntimeMessage {
  role: string;
  content: string | AioRuntimeContentPart[];
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

// Coerces an AI SDK file part's `data` field (a data: URL string, a plain
// base64 string, or a Uint8Array/ArrayBuffer) into a `data:` URL string for
// Hermes's OpenAI-vision-shaped `image_url` part.
function toImageDataUrl(data: unknown, mediaType: string | undefined): string {
  if (typeof data === "string") {
    return data.startsWith("data:") ? data : `data:${mediaType ?? "image/png"};base64,${data}`;
  }
  // Uint8Array / ArrayBuffer fallback — convert bytes to base64.
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${mediaType ?? "image/png"};base64,${base64}`;
}

function isImageFilePart(part: { type: string; mediaType?: string }): boolean {
  // `convertToModelMessages` emits image attachments as `{ type: "file", mediaType, data }`,
  // not `{ type: "image" }` — the latter never appears in practice.
  return part.type === "file" && Boolean(part.mediaType?.startsWith("image/"));
}

export async function buildRuntimeMessages(messages: UIMessage[]) {
  const modelMessages = await convertToModelMessages(messages);
  const runtimeMessages: AioRuntimeMessage[] = modelMessages.map((msg) => {
    if (!Array.isArray(msg.content)) {
      return { role: msg.role, content: String(msg.content) };
    }
    const hasImage = msg.content.some((part) => isImageFilePart(part));
    const parts: AioRuntimeContentPart[] = msg.content
      .map((part): AioRuntimeContentPart | null => {
        if (part.type === "text") return { type: "text", text: part.text };
        if (isImageFilePart(part)) {
          const filePart = part as { data: unknown; mediaType?: string };
          return { type: "image_url", image_url: { url: toImageDataUrl(filePart.data, filePart.mediaType) } };
        }
        return null;
      })
      .filter((part): part is AioRuntimeContentPart => part !== null);
    if (!hasImage) {
      return { role: msg.role, content: parts.map((p) => (p.type === "text" ? p.text : "")).join("") };
    }
    return { role: msg.role, content: parts };
  });

  const lastMessage = runtimeMessages[runtimeMessages.length - 1];
  const conversationHistory = runtimeMessages.slice(0, -1);

  return { runtimeMessages, lastMessage, conversationHistory };
}
