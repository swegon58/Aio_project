interface StartHermesRunInput {
  endpoint: string;
  apiServerKey: string;
  userId: string;
  input: string;
  conversationHistory: { role: string; content: string }[];
  sessionId: string;
  disableTools: boolean;
  instructions: string;
  signal: AbortSignal;
}

export async function startHermesRun(input: StartHermesRunInput): Promise<Response> {
  return fetch(`${input.endpoint}/v1/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiServerKey}`,
      "X-Hermes-Session-Key": input.userId,
    },
    body: JSON.stringify({
      input: input.input,
      conversation_history: input.conversationHistory,
      session_id: input.sessionId,
      disable_tools: input.disableTools,
      instructions: input.instructions,
    }),
    signal: input.signal,
  });
}

export async function openHermesRunEvents(input: {
  endpoint: string;
  apiServerKey: string;
  runId: string;
  signal: AbortSignal;
}): Promise<Response> {
  return fetch(`${input.endpoint}/v1/runs/${input.runId}/events`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.apiServerKey}`,
    },
    signal: input.signal,
  });
}
