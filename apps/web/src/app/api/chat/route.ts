import { NextRequest } from "next/server";
import { handleChatRequest } from "@/lib/aio/chat/chat-transport";

// R1.5 split: this route is transport-only. All domain logic (auth/context,
// credit reserve, the Hermes run, the SSE reader loop, settlement, conversation
// persistence, and the durable Aio run lifecycle) lives in the orchestrator at
// @/lib/aio/chat/run-orchestrator.ts, reached via the transport at
// @/lib/aio/chat/chat-transport.ts. See ADR-001 and docs/roadmap/R1_EXECUTION_CHECKLIST.md.
export async function POST(req: NextRequest) {
  return handleChatRequest(req);
}
