import { NextRequest } from "next/server";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { resolveHermesRequestContext } from "@/lib/hermes/request-context";
import { checkCreditBalance, refundTask, reserveCredits } from "@/lib/aio/billing/credit-guard";
import {
  actualCostCreditsFromUsageDelta,
  fetchOpenRouterKeyUsage,
  settleTask,
} from "@/lib/aio/billing/usage-settlement";
import { BUDGET_EXCEEDED_MARGIN, nextMonthlyResetAt, tierConfig, usedPercentForTier } from "@/lib/hermes/pricing";
import type { HermesShowcaseData, HermesUIMessage } from "@/lib/hermes/chat-types";
import { readAioChatRequest, buildRuntimeMessages } from "@/lib/aio/chat/chat-route-handler";
import { persistConversation } from "@/lib/aio/chat/conversation-persistence";
import { buildPlanInstructions, GUARDRAIL_SYSTEM_PROMPT } from "@/lib/aio/chat/plan-mode";
import { writeCreditSnapshot } from "@/lib/aio/chat/stream-writer";
import { startHermesRun, openHermesRunEvents } from "@/lib/aio/hermes/hermes-client";
import { HermesEventMapper } from "@/lib/aio/hermes/hermes-event-mapper";
import { artifactUrlForRunPath } from "@/lib/aio/hermes/hermes-artifacts";
import { parseHermesSseDataLine } from "@/lib/aio/hermes/hermes-stream";
import { buildKnowledgeContext } from "@/lib/aio/knowledge/retrieve-context";
import { resolveOpenRouterKeyForProfile } from "@/lib/hermes/knowledge";
import { scanAioInputMessages } from "@/lib/aio/security/input-scan";
import { legacyShowcaseFromAioTaskCodeExec, writeAioRunEventToLegacyStream } from "@/lib/aio/runs/run-event-writer";

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export async function POST(req: NextRequest) {
  const ctxResult = await resolveHermesRequestContext();
  if (!ctxResult.ok) return ctxResult.res;
  const { db, userId, row, planTier, apiServerKey, hermesSessionId, threadId } = ctxResult.ctx;
  if (!row.endpoint || !apiServerKey) {
    return Response.json({ error: "runtime_not_configured" }, { status: 503 });
  }

  // Item 1 (BUILD_SPEC §7 Q16): pre-task credit estimate + balance check.
  const creditCheck = checkCreditBalance(row);
  if (!creditCheck.ok) {
    return Response.json(
      {
        error: "insufficient_credits",
        message: "Not enough credits for this task. Top up your balance to continue.",
        estimate: creditCheck.estimate,
        balance: creditCheck.balance,
      },
      { status: 402 },
    );
  }

  // Item 3: speculative reservation — skipped in dev mode (billing RPC not applied).
  if (!DEV_BYPASS) await reserveCredits(db, userId, creditCheck.estimate);

  const { messages, planMode } = await readAioChatRequest(req);
  if (messages.length === 0) {
    return Response.json({ error: "no_messages" }, { status: 400 });
  }

  const { shouldBlock } = scanAioInputMessages(messages, { userId, threadId });

  // Repeated injection-pattern hits within the trailing window (see
  // abuse-tracker.ts) — soft-block this turn rather than forwarding it to
  // Hermes. Refund the reservation made above since the task never runs.
  if (shouldBlock) {
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    return Response.json(
      { error: "rate_limited", message: "Too many flagged messages in a short window. Try again later." },
      { status: 429 },
    );
  }

  // /v1/runs takes a single input plus optional conversation_history. Keep
  // the shape conversion in Aio's chat layer so this route stays transport-only.
  const { lastMessage, conversationHistory } = await buildRuntimeMessages(messages);
  const planInstructions = buildPlanInstructions(planMode, conversationHistory, lastMessage);

  // Item 2c: wall-clock timeout per task (config-driven by tier, pricing.ts).
  const caps = tierConfig(planTier).caps;
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), caps.wallClockTimeoutMs);

  // Item 3: OpenRouter key-usage snapshot before the task, for settlement.
  const openrouterApiKey = await resolveOpenRouterKeyForProfile(row.profile_name);
  const usageBefore = openrouterApiKey ? await fetchOpenRouterKeyUsage(openrouterApiKey) : null;

  // RAG knowledge-base context (open-webui parity feature) — retrieve the
  // customer's most relevant uploaded-document chunks for this turn's
  // question and fold them into the instructions sent to Hermes. Best-effort:
  // any failure here must not block the chat turn.
  const knowledgeContext = openrouterApiKey
    ? await buildKnowledgeContext(db, userId, openrouterApiKey, lastMessage)
    : null;

  let startResponse: Response;
  try {
    startResponse = await startHermesRun({
      endpoint: row.endpoint,
      apiServerKey,
      userId,
      input: typeof lastMessage?.content === "string" ? lastMessage.content : String(lastMessage?.content ?? ""),
      conversationHistory,
      sessionId: hermesSessionId,
      disableTools: Boolean(planMode),
      instructions: [GUARDRAIL_SYSTEM_PROMPT, planInstructions, knowledgeContext].filter(Boolean).join(" "),
      signal: abortController.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = abortController.signal.aborted;
    return Response.json(
      { error: timedOut ? "task_timeout" : "hermes_request_failed", message: msg },
      { status: timedOut ? 504 : 502 },
    );
  }

  if (startResponse.status !== 202) {
    clearTimeout(timeoutHandle);
    const errorText = await startResponse.text();
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    return new Response(`Hermes error: ${errorText}`, { status: startResponse.status });
  }

  const { run_id: runId } = (await startResponse.json()) as { run_id: string };

  let eventsResponse: Response;
  try {
    eventsResponse = await openHermesRunEvents({
      endpoint: row.endpoint,
      apiServerKey,
      runId,
      signal: abortController.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = abortController.signal.aborted;
    return Response.json(
      { error: timedOut ? "task_timeout" : "hermes_request_failed", message: msg },
      { status: timedOut ? 504 : 502 },
    );
  }

  if (!eventsResponse.ok || !eventsResponse.body) {
    clearTimeout(timeoutHandle);
    const errorText = await eventsResponse.text();
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    return new Response(`Hermes error: ${errorText}`, { status: eventsResponse.status });
  }

  const stream = createUIMessageStream<HermesUIMessage>({
    execute: async ({ writer }) => {
      const mapper = new HermesEventMapper({
        runId,
        threadId,
        artifactUrlForPath: (filePath) => artifactUrlForRunPath(runId, filePath),
      });
      writeAioRunEventToLegacyStream(writer, mapper.createRunEvent());

      const balanceAfterReserve = row.credit_balance - creditCheck.estimate;
      writeCreditSnapshot(writer, {
        runId,
        balance: balanceAfterReserve,
        usedPercent: usedPercentForTier(planTier, balanceAfterReserve),
        resetAt: nextMonthlyResetAt(),
        planTier,
      });

      const reader = eventsResponse.body!.getReader();
      const decoder = new TextDecoder();
      const textPartId = crypto.randomUUID();
      let textStarted = false;
      let buffer = "";
      let succeeded = false;
      let budgetExceeded = false;
      let assistantText = "";
      // Files surfaced by tool.completed events this turn, stamped onto the
      // persisted assistant message (metadata.artifacts) so the attachment
      // card survives a page reload instead of only existing in the
      // in-memory `activity` stream while the turn is live.
      const assistantArtifacts: { filePath: string; fileName?: string }[] = [];
      const assistantShowcases: HermesShowcaseData[] = [];

      // Item 2b: mid-stream budget cutoff.
      const budgetCreditLimit = Math.min(
        caps.creditBudget,
        creditCheck.estimate,
      ) * BUDGET_EXCEEDED_MARGIN;
      let lastBudgetCheck = Date.now();
      const BUDGET_CHECK_INTERVAL_MS = 15_000;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            succeeded = true;
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const evt = parseHermesSseDataLine(line);
            if (!evt) continue;

            for (const aioEvent of mapper.map(evt)) {
              if (aioEvent.type === "message.delta") {
                if (!aioEvent.delta) continue;
                if (!textStarted) {
                  writer.write({ type: "text-start", id: textPartId });
                  textStarted = true;
                }
                // Runtime sends multi-word bursts; re-chunk into small pieces
                // with a short delay so the UI renders a smooth, slowed-down
                // typewriter effect instead of text popping in in big jumps.
                for (let i = 0; i < aioEvent.delta.length; i += 3) {
                  writer.write({ type: "text-delta", id: textPartId, delta: aioEvent.delta.slice(i, i + 3) });
                  await new Promise((resolve) => setTimeout(resolve, 20));
                }
                assistantText += aioEvent.delta;
                continue;
              }

              if (aioEvent.type === "artifact.created") {
                assistantArtifacts.push(aioEvent.artifact);
                continue;
              }

              if (aioEvent.type === "task.codeexec") {
                const showcase = legacyShowcaseFromAioTaskCodeExec(aioEvent);
                const existingIdx = assistantShowcases.findIndex((s) => s.taskId === showcase.taskId);
                if (existingIdx >= 0) assistantShowcases[existingIdx] = showcase;
                else assistantShowcases.push(showcase);
              }

              writeAioRunEventToLegacyStream(writer, aioEvent);
            }
          }

          // Periodic mid-stream budget check (item 2b).
          if (openrouterApiKey && Date.now() - lastBudgetCheck > BUDGET_CHECK_INTERVAL_MS) {
            lastBudgetCheck = Date.now();
            const usageNow = await fetchOpenRouterKeyUsage(openrouterApiKey);
            const spentCredits = actualCostCreditsFromUsageDelta(
              usageBefore?.usageUsd ?? null,
              usageNow?.usageUsd ?? null,
              0,
              planTier,
            );
            if (spentCredits > budgetCreditLimit) {
              budgetExceeded = true;
              abortController.abort();
              break;
            }
          }
        }
      } finally {
        clearTimeout(timeoutHandle);
        if (textStarted) {
          writer.write({ type: "text-end", id: textPartId });
        }
        if (budgetExceeded) {
          writer.write({
            type: "error",
            errorText: "Budget exceeded for this task. Reply to continue or start a new task.",
          });
        }

        // Item 3 settlement (success path) / Q29 refund (failure/abort path).
        // Skipped in dev mode (billing RPC not applied to Supabase yet).
        if (!DEV_BYPASS) {
          if (succeeded && !budgetExceeded) {
            const usageAfter = openrouterApiKey ? await fetchOpenRouterKeyUsage(openrouterApiKey) : null;
            const actualCredits = actualCostCreditsFromUsageDelta(
              usageBefore?.usageUsd ?? null,
              usageAfter?.usageUsd ?? null,
              creditCheck.estimate,
              planTier,
            );
            await settleTask(db, userId, creditCheck.estimate, actualCredits);
          } else {
            await refundTask(db, userId, creditCheck.estimate);
          }
        }

        // New-chat/history persistence — independent of billing/DEV_BYPASS,
        // since chat history must work in dev mode too.
        await persistConversation(
          db, userId, threadId, messages, assistantText, planMode, assistantArtifacts, assistantShowcases,
        );
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
