// R6.8 beta gate: per-customer lifetime spend cap. Off by default — only
// enforced when AIO_BETA_SPEND_CAP_CREDITS is set to a positive number,
// which the owner configures for the limited-cohort beta. Reuses
// aio_runs.actual_credits (already settled per run, see weekly-metrics.ts)
// instead of adding a new running-total column.
//
// R11.1 extension: per-tool spend sub-limits for #4 Code Execution and #5 Browser Automation.
// Same dollar-based accounting model, enforced at tool-execution checkpoints.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SpendCapResult {
  ok: boolean;
  capCredits: number | null;
  spentCredits: number;
}

export interface ToolSubLimitResult {
  ok: boolean;
  limitUsd: number | null;
  spentUsd: number;
  toolId: string;
}

// Ponytail: Fixed credit-to-USD conversion. 1 credit = $0.01 (100 credits = $1).
// This matches typical LLM pricing patterns and keeps math simple.
// Upgrade path: Make this configurable per provider if actual costs diverge.
const CREDITS_TO_USD = 0.01;

export function configuredSpendCapCredits(): number | null {
  const raw = process.env.AIO_BETA_SPEND_CAP_CREDITS;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function checkSpendCap(db: SupabaseClient, customerId: string): Promise<SpendCapResult> {
  const capCredits = configuredSpendCapCredits();
  if (capCredits === null) return { ok: true, capCredits: null, spentCredits: 0 };

  const { data, error } = await db
    .from("aio_runs")
    .select("actual_credits")
    .eq("customer_id", customerId)
    .eq("status", "completed");
  if (error) throw new Error(`Spend cap lookup failed: ${error.message}`);

  const spentCredits = (data ?? []).reduce(
    (sum: number, r: { actual_credits: number | null }) => sum + (r.actual_credits ?? 0),
    0,
  );
  return { ok: spentCredits < capCredits, capCredits, spentCredits };
}

/**
 * R11.1: Check per-tool spend sub-limit before execution.
 *
 * Ponytail: Sum actual_credits from completed runs that used the specific tool
 * (via aio_tool_calls.tool_name lookup), convert to USD, compare against limit.
 *
 * Called from POST /api/chat/approval (src/app/api/chat/approval/route.ts):
 * that route is the one place Next.js mediates a specific tool call before
 * Hermes proceeds (the mandatory-approval gate for code_execution/browser),
 * so it looks up the pending aio_approvals row for the run to get tool_name,
 * then checks the limit before forwarding an approve-type choice.
 */
export async function checkToolSubLimit(
  db: SupabaseClient,
  customerId: string,
  toolId: string,
): Promise<ToolSubLimitResult> {
  // Ponytail: Only enforce limits for gated tools (code_execution, browser).
  // Other tools return { ok: true, limitUsd: null, spentUsd: 0 } — no limit, no check.
  if (!isGatedTool(toolId)) {
    return { ok: true, limitUsd: null, spentUsd: 0, toolId };
  }

  // Fetch the customer's limit for this tool (uses default if not set)
  const limitUsd = await getToolSubLimitUsd(db, customerId, toolId);
  if (limitUsd === null) {
    // No limit found (shouldn't happen with defaults, but safe fallback)
    return { ok: true, limitUsd: null, spentUsd: 0, toolId };
  }

  // Calculate total USD spent on this tool across all completed runs
  const spentUsd = await getToolSpendUsd(db, customerId, toolId);

  return {
    ok: spentUsd < limitUsd,
    limitUsd,
    spentUsd,
    toolId,
  };
}

/**
 * Calculate total USD spent on a specific tool by a customer.
 *
 * Ponytail: Sum actual_credits from completed runs that contain tool calls
 * for the specified tool. This joins aio_runs -> aio_tool_calls on run_id
 * and filters by tool_name and status=completed.
 */
async function getToolSpendUsd(
  db: SupabaseClient,
  customerId: string,
  toolId: string,
): Promise<number> {
  const { data: calls, error: callsError } = await db
    .from("aio_tool_calls")
    .select("run_id")
    .eq("customer_id", customerId)
    .eq("tool_name", toolId);
  if (callsError) throw new Error(`Tool call lookup failed: ${callsError.message}`);

  const runIds = Array.from(new Set((calls ?? []).map((c: { run_id: string }) => c.run_id)));
  if (runIds.length === 0) return 0;

  const { data, error } = await db
    .from("aio_runs")
    .select("actual_credits")
    .eq("customer_id", customerId)
    .eq("status", "completed")
    .in("id", runIds);

  if (error) throw new Error(`Tool spend lookup failed: ${error.message}`);

  const spentCredits = (data ?? []).reduce(
    (sum: number, r: { actual_credits: number | null }) => sum + (r.actual_credits ?? 0),
    0,
  );

  return spentCredits * CREDITS_TO_USD;
}

/**
 * Get the per-tool sub-limit in USD for a customer.
 *
 * Ponytail: Read from aio_tool_sub_limits table. If no row exists, return the
 * default limit for that tool (code_execution: $10, browser: $20).
 */
async function getToolSubLimitUsd(
  db: SupabaseClient,
  customerId: string,
  toolId: string,
): Promise<number | null> {
  const { data, error } = await db
    .from("aio_tool_sub_limits")
    .select("limit_usd")
    .eq("customer_id", customerId)
    .eq("tool_id", toolId)
    .maybeSingle();

  if (error) throw new Error(`Tool sub-limit lookup failed: ${error.message}`);

  // Return explicit limit if found, otherwise use defaults
  return data?.limit_usd ?? getDefaultToolSubLimitUsd(toolId);
}

/**
 * Ponytail: Default per-tool sub-limits in USD.
 * These are defensive safety ceilings to prevent runaway costs while opening
 * the tools to all pricing tiers. Real usage patterns will inform future adjustments.
 *
 * Upgrade path: Make these configurable via Settings UI when patterns emerge.
 */
function getDefaultToolSubLimitUsd(toolId: string): number | null {
  const defaults: Record<string, number> = {
    code_execution: 10.0, // $10 for code execution
    browser: 20.0,        // $20 for browser automation
  };
  return defaults[toolId] ?? null;
}

/**
 * Check if a tool requires per-tool sub-limit enforcement.
 *
 * Ponytail: Only the two new R11.1 gated tools (code_execution, browser) get
 * sub-limits. All other tools return false — no sub-limit check.
 */
function isGatedTool(toolId: string): boolean {
  return toolId === "code_execution" || toolId === "browser";
}
