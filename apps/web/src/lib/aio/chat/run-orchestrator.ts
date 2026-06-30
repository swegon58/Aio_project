// Server-only orchestrator for the Aio chat run (ADR-001 / R1.5). Owns the full
// domain flow — auth/context resolution, credit reserve, input safety scan,
// knowledge context, the Hermes run, the SSE reader loop, settlement, and
// conversation persistence — and the durable Aio run lifecycle that wraps it:
//
//   createRun(queued) ── BEFORE the Hermes call ──▶ startHermesRun
//     ▶ attachHermesIdentity ▶ transitionRun(queued→running)
//     ▶ openHermesRunEvents ▶ stream loop (appendEvent per event)
//     ▶ finally: settle/refund + persistConversation + close the run
//       (running→completed on success, running→failed otherwise)
//
// The transport (chat-transport.ts) only parses the request, guards the empty
// case, wires the client disconnect signal, and wraps the returned `execute` in
// a UI message stream. No lifecycle SQL lives in the route or the transport —
// it all goes through the run / run-event repositories here.
//
// Durability note: R1.5 fails closed if `createRun` cannot persist the product
// run before Hermes starts. After that point, lifecycle writes are best-effort
// logged so a repository hiccup does not mask the original task outcome.
//
import { createHash } from "node:crypto";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import { checkCreditBalance, refundTask, reserveCredits } from "@/lib/aio/billing/credit-guard";
import {
  actualCostCreditsFromUsageDelta,
  fetchOpenRouterKeyUsage,
  settleTask,
} from "@/lib/aio/billing/usage-settlement";
import { BUDGET_EXCEEDED_MARGIN, nextMonthlyResetAt, tierConfig, usedPercentForTier } from "@/lib/hermes/pricing";
import { markActivatedIfNeeded } from "@/lib/hermes/registry";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import type { AioChatMode } from "@/lib/aio/chat/chat-mode";
import type { HermesShowcaseData, HermesUIMessage } from "@/lib/hermes/chat-types";
import { buildRuntimeMessages } from "@/lib/aio/chat/chat-route-handler";
import { persistConversation } from "@/lib/aio/chat/conversation-persistence";
import { buildPlanInstructions, GUARDRAIL_SYSTEM_PROMPT } from "@/lib/aio/chat/plan-mode";
import { buildResearchInstructions, isWebResearchTool } from "@/lib/aio/chat/research-mode";
import { writeCreditSnapshot } from "@/lib/aio/chat/stream-writer";
import { startHermesRun, openHermesRunEvents } from "@/lib/aio/hermes/hermes-client";
import { HermesEventMapper } from "@/lib/aio/hermes/hermes-event-mapper";
import { artifactUrlForRunPath } from "@/lib/aio/hermes/hermes-artifacts";
import { parseHermesSseDataLine } from "@/lib/aio/hermes/hermes-stream";
import { buildKnowledgeContext } from "@/lib/aio/knowledge/retrieve-context";
import { resolveOpenRouterKeyForProfile } from "@/lib/hermes/knowledge";
import { scanAioInputMessages } from "@/lib/aio/security/input-scan";
import {
  legacyShowcaseFromAioTaskCodeExec,
  writeAioRunEventToLegacyStream,
} from "@/lib/aio/runs/run-event-writer";
import {
  attachHermesIdentity,
  createRun,
  markTerminal,
  transitionRun,
} from "@/lib/aio/runs/run-repository";
import { appendEvent } from "@/lib/aio/runs/run-event-repository";
import { recordToolCallEvent } from "@/lib/aio/tools/tool-call-writer";
import { recordApprovalEvent } from "@/lib/aio/tools/approval-writer";
import type { AioRunEvent } from "@/lib/aio/runs/aio-run-events";
import type { AioRunEventEnvelopeSource } from "@/lib/aio/runs/aio-run-event-schema";
import { type AioTelemetry, NO_OP_TELEMETRY } from "@/lib/aio/telemetry/telemetry";
import { SPANS, METRICS, runAttrs } from "@/lib/aio/telemetry/span-builder";
import type { HermesRequestContext } from "@/lib/hermes/request-context";

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export interface OrchestratorInput {
  /** Request abort signal; firing it aborts the Hermes run (client disconnect). */
  clientSignal: AbortSignal;
  messages: UIMessage[];
  mode: AioChatMode;
  planMode: boolean;
  /** Optional telemetry — defaults to no-op; never blocks the primary path. */
  telemetry?: AioTelemetry;
  /** Optional pre-resolved runtime context for non-request callers (workers). */
  contextOverride?: HermesRequestContext;
}

export type OrchestratorResult =
  | {
      ok: true;
      runId: string;
      execute: (stream: {
        writer: UIMessageStreamWriter<HermesUIMessage>;
      }) => Promise<void>;
    }
  | { ok: false; response: Response };

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, inner]) => `${JSON.stringify(key)}:${stableJson(inner)}`);
  return `{${entries.join(",")}}`;
}

function deterministicUuid(seed: string): string {
  const hex = createHash("sha1").update(seed).digest("hex");
  const part1 = hex.slice(0, 8);
  const part2 = hex.slice(8, 12);
  const part3 = ((parseInt(hex.slice(12, 16), 16) & 0x0fff) | 0x5000)
    .toString(16)
    .padStart(4, "0");
  const part4 = ((parseInt(hex.slice(16, 20), 16) & 0x3fff) | 0x8000)
    .toString(16)
    .padStart(4, "0");
  const part5 = hex.slice(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

function stableRunEventIdentity(
  runId: string,
  source: AioRunEventEnvelopeSource,
  event: AioRunEvent,
  hermesRunId?: string,
): { envelopeId: string; eventId: string } {
  const eventIdentity = stableJson({
    runId,
    source,
    hermesRunId: hermesRunId ?? null,
    event,
  });
  return {
    envelopeId: deterministicUuid(`aio-envelope:${eventIdentity}`),
    eventId: deterministicUuid(`aio-event:${eventIdentity}`),
  };
}

function eventOccurredAt(event: AioRunEvent): string | number {
  return event.createdAt ?? event.ts ?? Date.now();
}

function eventForDurableRun(event: AioRunEvent, durableRunId: string): AioRunEvent {
  return { ...event, runId: durableRunId };
}

/**
 * Run one Aio chat turn end-to-end. On a non-recoverable pre-stream failure
 * returns `{ ok: false, response }` (already-settled: reserved credits refunded,
 * run marked failed). On success returns `{ ok: true, execute }`; the transport
 * invokes `execute` inside a UI message stream. Credits settle exactly once and
 * the run is closed with a stable terminal outcome regardless of how the stream
 * ends (success, budget cutoff, client abort, or error).
 */
export async function orchestrateAioChatRun(
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const {
    clientSignal,
    messages,
    mode,
    planMode,
    telemetry = NO_OP_TELEMETRY,
    contextOverride,
  } = input;
  const { tracer, metrics } = telemetry;

  // ---- auth / provisioning / key resolution ----
  const ctxResult = contextOverride
    ? { ok: true as const, ctx: contextOverride }
    : await import("@/lib/hermes/request-context").then(({ resolveHermesRequestContext }) =>
        resolveHermesRequestContext(),
      );
  if (!ctxResult.ok) return { ok: false, response: ctxResult.res };
  const { db, userId, row, planTier, apiServerKey, hermesSessionId, threadId } = ctxResult.ctx;
  if (!row.endpoint || !apiServerKey) {
    return { ok: false, response: Response.json({ error: "runtime_not_configured" }, { status: 503 }) };
  }

  // ---- rate limit (per user, before any credit reservation) ----
  const chatRateLimit = checkRateLimit(`chat:${userId}`, 20, 60_000);
  if (!chatRateLimit.allowed) {
    return { ok: false, response: rateLimitResponse(chatRateLimit.retryAfterSeconds) };
  }

  // ---- credit balance check + speculative reservation ----
  const creditCheck = checkCreditBalance(row);
  if (!creditCheck.ok) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "insufficient_credits",
          message: "Not enough credits for this task. Top up your balance to continue.",
          estimate: creditCheck.estimate,
          balance: creditCheck.balance,
        },
        { status: 402 },
      ),
    };
  }
  if (!DEV_BYPASS) await reserveCredits(db, userId, creditCheck.estimate);

  // ---- input safety scan (soft-block repeats; refund since the run never starts) ----
  const { shouldBlock } = scanAioInputMessages(messages, { userId, threadId });
  if (shouldBlock) {
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    return {
      ok: false,
      response: Response.json(
        { error: "rate_limited", message: "Too many flagged messages in a short window. Try again later." },
        { status: 429 },
      ),
    };
  }

  // ---- runtime message shape + instructions ----
  const { lastMessage, conversationHistory } = await buildRuntimeMessages(messages);
  const planInstructions = buildPlanInstructions(planMode, conversationHistory, lastMessage);
  const researchInstructions = buildResearchInstructions(mode);

  // ---- wall-clock timeout + client-disconnect abort ----
  const caps = tierConfig(planTier).caps;
  const abortController = new AbortController();
  const abortFromClient = () => abortController.abort();
  clientSignal.addEventListener("abort", abortFromClient, { once: true });
  const timeoutHandle = setTimeout(() => abortController.abort(), caps.wallClockTimeoutMs);
  const teardown = () => {
    clearTimeout(timeoutHandle);
    clientSignal.removeEventListener("abort", abortFromClient);
  };

  // ---- OpenRouter usage snapshot (for settlement) + RAG knowledge context ----
  const openrouterApiKey = await resolveOpenRouterKeyForProfile(row.profile_name);
  const usageBefore = openrouterApiKey ? await fetchOpenRouterKeyUsage(openrouterApiKey) : null;
  const knowledgeContext = openrouterApiKey
    ? await buildKnowledgeContext(db, userId, openrouterApiKey, lastMessage)
    : null;

  // ---- create the durable Aio run row BEFORE the Hermes call (ADR-001 §1) ----
  const firstUserText = messages[0]?.parts?.find(
    (p): p is { type: "text"; text: string } => p.type === "text",
  )?.text;
  const created = await createRun(db, {
    customerId: userId,
    threadId,
    conversationId: threadId,
    mode,
    inputSummary: firstUserText ? firstUserText.slice(0, 200) : null,
    reservedCredits: creditCheck.estimate,
    metadata: { planMode, mode },
  });
  if (!created.ok) {
    teardown();
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    return {
      ok: false,
      response: Response.json(
        {
          error: "durable_run_create_failed",
          message: "Aio could not create the durable run record before starting this task.",
        },
        { status: 500 },
      ),
    };
  }
  const aioRunId = created.data.id;

  // Marks the run failed (if it was created) for a pre-stream failure. Never
  // throws — lifecycle closure must not mask the HTTP error path.
  const failRun = async (errorCode: string, message?: string) => {
    try {
      const res = await markTerminal(db, aioRunId, userId, "failed", {
        errorCode,
        errorMessageRedacted: message ?? null,
      });
      if (!res.ok) console.error(`failRun(${errorCode}) could not close run ${aioRunId}:`, res.message);
    } catch (err) {
      console.error(`failRun(${errorCode}) threw for run ${aioRunId}:`, err);
    }
  };

  // Increment run-started counter as soon as the durable row exists.
  metrics.increment(METRICS.RUNS_STARTED, { mode, plan_tier: planTier });

  // ---- start the Hermes run ----
  let startResponse: Response;
  const hermesStartSpan = tracer.startSpan(SPANS.HERMES_START, { "aio.run_id": aioRunId, "aio.mode": mode });
  const hermesStartT = Date.now();
  try {
    startResponse = await startHermesRun({
      endpoint: row.endpoint,
      apiServerKey,
      userId,
      input: typeof lastMessage?.content === "string" ? lastMessage.content : String(lastMessage?.content ?? ""),
      conversationHistory,
      sessionId: hermesSessionId,
      disableTools: Boolean(planMode),
      instructions: [GUARDRAIL_SYSTEM_PROMPT, planInstructions, researchInstructions, knowledgeContext]
        .filter(Boolean)
        .join(" "),
      signal: abortController.signal,
    });
    metrics.histogram(METRICS.HERMES_START_LATENCY_MS, Date.now() - hermesStartT, { mode });
    hermesStartSpan.end();
  } catch (err) {
    hermesStartSpan.setError(err instanceof Error ? err.constructor.name : "UnknownError");
    hermesStartSpan.end();
    teardown();
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    await failRun("hermes_request_failed", "Hermes run could not be started.");
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = abortController.signal.aborted;
    return {
      ok: false,
      response: Response.json(
        { error: timedOut ? "task_timeout" : "hermes_request_failed", message: msg },
        { status: timedOut ? 504 : 502 },
      ),
    };
  }

  if (startResponse.status !== 202) {
    teardown();
    const errorText = await startResponse.text();
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    await failRun("hermes_request_failed", `Hermes rejected the run: ${startResponse.status}`);
    return { ok: false, response: new Response(`Hermes error: ${errorText}`, { status: startResponse.status }) };
  }

  const { run_id: hermesRunId } = (await startResponse.json()) as { run_id: string };

  // Attach the Hermes identity (adapter metadata, never the product id) and move
  // the run to `running` before opening the event stream.
  const attached = await attachHermesIdentity(db, aioRunId, userId, hermesRunId, hermesSessionId);
  if (attached.ok) {
    const running = await transitionRun(db, aioRunId, userId, "running");
    if (!running.ok) console.error(`transitionRun(running) for ${aioRunId}:`, running.message);
  } else {
    console.error(`attachHermesIdentity for ${aioRunId}:`, attached.message);
  }

  // ---- open the Hermes event stream ----
  let eventsResponse: Response;
  try {
    eventsResponse = await openHermesRunEvents({
      endpoint: row.endpoint,
      apiServerKey,
      runId: hermesRunId,
      signal: abortController.signal,
    });
  } catch (err) {
    teardown();
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    await failRun("hermes_request_failed", "Hermes event stream could not be opened.");
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = abortController.signal.aborted;
    return {
      ok: false,
      response: Response.json(
        { error: timedOut ? "task_timeout" : "hermes_request_failed", message: msg },
        { status: timedOut ? 504 : 502 },
      ),
    };
  }

  if (!eventsResponse.ok || !eventsResponse.body) {
    teardown();
    const errorText = await eventsResponse.text();
    if (!DEV_BYPASS) await refundTask(db, userId, creditCheck.estimate);
    await failRun("hermes_request_failed", `Hermes events rejected: ${eventsResponse.status}`);
    return { ok: false, response: new Response(`Hermes error: ${errorText}`, { status: eventsResponse.status }) };
  }

  // Capture everything the execute body closes over; createUIMessageStream runs
  // it when the stream is consumed (after this function has returned).
  const runIdForLegacy = hermesRunId;
  const runIdForDurable = aioRunId;
  const body = eventsResponse.body;

  // ---- durable append of one mapped event (timeline / R1.7 replay) ----
  const persistEvent = async (event: AioRunEvent, source: AioRunEventEnvelopeSource) => {
    const durableEvent = eventForDurableRun(event, runIdForDurable);
    const identity = stableRunEventIdentity(runIdForDurable, source, durableEvent, hermesRunId);
    try {
      const res = await appendEvent(db, {
        id: identity.envelopeId,
        runId: runIdForDurable,
        customerId: userId,
        source,
        payload: durableEvent,
        occurredAt: eventOccurredAt(durableEvent),
        receivedAt: Date.now(),
        hermes: { runId: hermesRunId, eventId: identity.eventId },
      });
      if (!res.ok) console.error(`appendEvent(${event.type}) for run ${runIdForDurable}:`, res.message);
    } catch (err) {
      console.error(`appendEvent(${event.type}) threw for run ${runIdForDurable}:`, err);
    }
  };

  const execute = async ({ writer }: { writer: UIMessageStreamWriter<HermesUIMessage> }) => {
    const turnSpan = tracer.startSpan(
      SPANS.CHAT_TURN,
      runAttrs({ runId: runIdForDurable, userId, modelName: row.profile_name ?? undefined, status: "running" }),
    );
    const turnStart = Date.now();

    const mapper = new HermesEventMapper({
      runId: runIdForLegacy,
      threadId,
      artifactUrlForPath: (filePath) => artifactUrlForRunPath(runIdForLegacy, filePath),
    });
    const runCreatedEvent = mapper.createRunEvent();
    writeAioRunEventToLegacyStream(writer, runCreatedEvent);
    await persistEvent(runCreatedEvent, "aio");

    const balanceAfterReserve = row.credit_balance - creditCheck.estimate;
    writeCreditSnapshot(writer, {
      runId: runIdForLegacy,
      balance: balanceAfterReserve,
      usedPercent: usedPercentForTier(planTier, balanceAfterReserve),
      resetAt: nextMonthlyResetAt(),
      planTier,
    });

    const reader = body.getReader();
    const decoder = new TextDecoder();
    const textPartId = crypto.randomUUID();
    let textStarted = false;
    let buffer = "";
    let succeeded = false;
    let budgetExceeded = false;
    let assistantText = "";
    const assistantArtifacts: { filePath: string; fileName?: string }[] = [];
    const assistantShowcases: HermesShowcaseData[] = [];
    const researchToolCallIds = new Set<string>();
    const researchSearchCallIds = new Set<string>();

    // Item 2b: mid-stream budget cutoff.
    const budgetCreditLimit = Math.min(caps.creditBudget, creditCheck.estimate) * BUDGET_EXCEEDED_MARGIN;
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
            // Durable timeline: persist every mapped event (best-effort) before
            // publishing to the legacy UI stream, so the stored sequence mirrors
            // the order the UI saw.
            await persistEvent(aioEvent, "hermes");

            // Durable tool-call rows (R2.2): best-effort, idempotent, no-op for
            // non-tool events. Snapshots manifest risk/approval policy + redacted I/O.
            await recordToolCallEvent(db, { runId: runIdForDurable, customerId: userId }, aioEvent);

            // Durable approval rows (R2.3): best-effort, idempotent, no-op for
            // non-approval events. Snapshots risk + redacted request + TTL and
            // keeps approval state consistent with the shared event stream.
            await recordApprovalEvent(db, { runId: runIdForDurable, customerId: userId }, aioEvent);

            if (mode === "research" && aioEvent.type === "tool.started") {
              researchToolCallIds.add(aioEvent.toolCallId);
              if (isWebResearchTool(aioEvent.toolName)) {
                researchSearchCallIds.add(aioEvent.toolCallId);
              }
            }

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
              const filePath = aioEvent.artifact?.filePath ?? aioEvent.url;
              if (filePath) {
                assistantArtifacts.push({ filePath, fileName: aioEvent.artifact?.fileName ?? aioEvent.name });
              }
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
      teardown();
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
      let settledActualCredits: number | null = null;
      if (!DEV_BYPASS) {
        if (succeeded && !budgetExceeded) {
          const usageAfter = openrouterApiKey ? await fetchOpenRouterKeyUsage(openrouterApiKey) : null;
          const actualCredits = actualCostCreditsFromUsageDelta(
            usageBefore?.usageUsd ?? null,
            usageAfter?.usageUsd ?? null,
            creditCheck.estimate,
            planTier,
          );
          settledActualCredits = actualCredits;
          await settleTask(db, userId, creditCheck.estimate, actualCredits);

          // R6.1 activation: first successful run only (idempotent guard
          // lives in markActivatedIfNeeded — later runs are no-ops).
          if (await markActivatedIfNeeded(db, userId)) {
            metrics.increment(METRICS.USERS_ACTIVATED, { plan_tier: planTier });
          }
        } else {
          await refundTask(db, userId, creditCheck.estimate);
        }
      }

      // Close the durable run with a stable terminal outcome. Best-effort: a
      // closure failure is logged but must not mask settlement/persistence.
      try {
        if (succeeded && !budgetExceeded) {
          const closed = await markTerminal(db, runIdForDurable, userId, "completed", {
            actualCredits: settledActualCredits,
          });
          if (!closed.ok) console.error(`markTerminal(completed) for ${runIdForDurable}:`, closed.message);
        } else {
          const errorCode = budgetExceeded
            ? "budget_exceeded"
            : abortController.signal.aborted
              ? "client_aborted"
              : "stream_error";
          await failRun(errorCode);
        }
      } catch (err) {
        console.error(`run closure threw for ${runIdForDurable}:`, err);
      }

      // New-chat/history persistence — independent of billing/DEV_BYPASS,
      // since chat history must work in dev mode too.
      await persistConversation(
        db,
        userId,
        threadId,
        messages,
        assistantText,
        mode,
        assistantArtifacts,
        assistantShowcases,
        mode === "research"
          ? {
              status: succeeded && !budgetExceeded ? "completed" : "interrupted",
              searchCount: researchSearchCallIds.size,
              toolCount: researchToolCallIds.size,
            }
          : undefined,
      );

      // Telemetry: close the turn span + record outcome metrics. Best-effort —
      // never throws. Placed after all other work to capture total wall-clock time.
      try {
        const latency = Date.now() - turnStart;
        const outcome = succeeded && !budgetExceeded ? "completed" : budgetExceeded ? "budget_exceeded" : "failed";
        turnSpan.setAttribute("aio.run.outcome", outcome);
        turnSpan.setAttribute("aio.mode", mode);
        turnSpan.end();
        metrics.histogram(METRICS.CHAT_TURN_LATENCY_MS, latency, { mode, outcome });
        if (succeeded && !budgetExceeded) {
          metrics.increment(METRICS.RUNS_COMPLETED, { mode, plan_tier: planTier });
        } else {
          metrics.increment(METRICS.RUNS_FAILED, { mode, plan_tier: planTier, reason: outcome });
        }
      } catch {
        // telemetry must never surface to the user
      }
    }
  };

  return { ok: true, runId: aioRunId, execute };
}
