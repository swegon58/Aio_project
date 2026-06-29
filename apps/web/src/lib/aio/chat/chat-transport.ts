// Transport layer for the Aio chat route (ADR-001 / R1.5). Deliberately thin:
// it owns only request-level concerns — parsing the chat payload, guarding the
// empty-messages case, handing the client disconnect signal to the orchestrator,
// and wrapping the orchestrator's `execute` body in a UI message stream + HTTP
// response.
//
// Everything domain — auth/context, credit reserve, the Hermes run, the SSE
// reader loop, settlement, conversation persistence, and the durable Aio run
// lifecycle — lives in run-orchestrator.ts. No lifecycle SQL or billing lives
// here; this file never touches the run repositories directly.

import { NextRequest } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { readAioChatRequest } from "@/lib/aio/chat/chat-route-handler";
import { orchestrateAioChatRun } from "@/lib/aio/chat/run-orchestrator";
import type { HermesUIMessage } from "@/lib/hermes/chat-types";

/**
 * Handle an inbound Aio chat POST. Returns the final HTTP response: an error
 * Response for a non-recoverable pre-stream failure, or a UI message stream
 * response for a run the orchestrator started.
 */
export async function handleChatRequest(req: NextRequest): Promise<Response> {
  const { messages, mode, planMode } = await readAioChatRequest(req);
  if (messages.length === 0) {
    return Response.json({ error: "no_messages" }, { status: 400 });
  }

  const result = await orchestrateAioChatRun({
    clientSignal: req.signal,
    messages,
    mode,
    planMode,
  });

  if (!result.ok) return result.response;

  const stream = createUIMessageStream<HermesUIMessage>({ execute: result.execute });
  return createUIMessageStreamResponse({ stream });
}
