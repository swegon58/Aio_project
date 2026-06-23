// Aio × Hermes — pricing & per-tier config (BUILD_SPEC §7 Q21/Q34, §8 Q17).
//
// All $ amounts, credit amounts, model IDs, and caps below are 🔢 tunable —
// change here, no redeploy needed elsewhere (pricing.ts is the single source
// other modules import from).
//
// Credit unit: 1 credit = $0.001 of underlying OpenRouter cost (i.e. credits
// are stored as "millicents" of raw model cost, BEFORE markup). This keeps
// the numbers human-sized (a $9 plan ~= 9000 raw-cost credits before markup
// is applied at settlement) while avoiding floating-point dollar math in the
// registry. See `creditsForUsd` / `usdForCredits` below.

export type PlanTier = "starter" | "pro" | "business";

export interface TierConfig {
  /** Display name. */
  label: string;
  /** Anchor monthly price in USD (🔢 tune vs real cost data — Q21). */
  monthlyPriceUsd: number;
  /** Credits granted on monthly top-up (1 credit = $0.001 raw model cost). */
  monthlyCredits: number;
  /**
   * OpenRouter model ID used for this tier's chat completions (Q34).
   * Concrete current model IDs — swappable here without redeploy.
   * Starter = Haiku/mini class, Pro = Sonnet class, Business = Opus class.
   */
  model: string;
  /** Markup multiplier applied to raw OpenRouter cost at settlement. */
  markup: number;
  /**
   * Hard spend ceiling (USD, raw OpenRouter cost) for this tier's
   * per-customer OpenRouter key (Q15), monthly reset. Provider-level
   * backstop — set above `monthlyCredits` in USD terms (some headroom for
   * top-ups) so it only fires on a genuinely runaway customer.
   */
  openrouterMonthlySpendLimitUsd: number;
  /** Per-task safety caps (Q17), defense-in-depth. */
  caps: {
    /** (a) max agent tool-calling iterations — written to profile config.yaml `agent.max_turns`. */
    maxIterations: number;
    /** (b) per-task credit budget — gateway-level "budget exceeded" cutoff. */
    creditBudget: number;
    /** (c) wall-clock timeout for a single proxied chat request, in ms. */
    wallClockTimeoutMs: number;
  };
  /**
   * Hermes toolset IDs unlocked for this tier (locked via grill-me
   * 2026-06-20, see Aio_harness/docs/decisions/tier-toolset-gating-grill.md).
   * Written to the profile's `agent.disabled_toolsets` on every spawn by
   * `applyTierConfig()` — anything in ALL_GATEABLE_TOOLSETS but not listed
   * here gets disabled. `file`/`terminal` are not in this list because
   * they're base infra, not gateable toolsets — always available.
   */
  toolsets: string[];
}

// Every Hermes toolset ID that is relevant to Aio and gateable by tier.
// Anything outside this set (homeassistant, spotify, yuanbao, discord,
// kanban, etc. — not relevant to Aio's product) stays disabled for all
// tiers regardless of `toolsets` below.
export const ALL_GATEABLE_TOOLSETS = [
  "clarify",
  "todo",
  "web",
  "code_execution",
  "browser",
  "vision",
  "memory",
  "delegation",
  "image_gen",
  "video_gen",
  "cronjob",
  "tts",
  "skills",
] as const;

export const TIERS: Record<PlanTier, TierConfig> = {
  starter: {
    label: "Starter",
    monthlyPriceUsd: 9, // 🔢
    monthlyCredits: 6000, // 🔢 ~$6 of raw model cost before markup
    model: "anthropic/claude-haiku-4.5", // 🔢 Haiku class
    markup: 1.5, // 🔢
    openrouterMonthlySpendLimitUsd: 15, // 🔢 ~2.5x the $6 raw-cost allowance, headroom for top-ups
    caps: {
      maxIterations: 40, // 🔢
      creditBudget: 800, // 🔢 ~$0.80 raw cost per task
      wallClockTimeoutMs: 5 * 60 * 1000, // 🔢 5 min
    },
    toolsets: ["clarify", "todo", "web", "skills"], // 🔢 locked grill-me 2026-06-20, skills opened to all tiers 2026-06-23
  },
  pro: {
    label: "Pro",
    monthlyPriceUsd: 19, // 🔢
    monthlyCredits: 14000, // 🔢 ~$14 of raw model cost before markup (~740 credits/$, in line with starter's ~670/$ and business's ~810/$)
    model: "anthropic/claude-sonnet-4.5", // 🔢 Sonnet class
    markup: 1.4, // 🔢
    openrouterMonthlySpendLimitUsd: 35, // 🔢 ~2.5x the $14 raw-cost allowance, headroom for top-ups
    caps: {
      maxIterations: 70, // 🔢
      creditBudget: 2500, // 🔢 ~$2.50 raw cost per task
      wallClockTimeoutMs: 10 * 60 * 1000, // 🔢 10 min
    },
    toolsets: [
      "clarify",
      "todo",
      "web",
      "code_execution",
      "browser",
      "vision",
      "memory",
      "delegation",
      "skills",
    ], // 🔢 locked grill-me 2026-06-20 (Starter + code/browser/vision/memory/delegate), skills opened to all tiers 2026-06-23
  },
  business: {
    label: "Business",
    monthlyPriceUsd: 99, // 🔢
    monthlyCredits: 80000, // 🔢 ~$80 of raw model cost before markup
    model: "anthropic/claude-opus-4.1", // 🔢 Opus class
    markup: 1.3, // 🔢
    openrouterMonthlySpendLimitUsd: 200, // 🔢 ~2.5x the $80 raw-cost allowance, headroom for top-ups
    caps: {
      maxIterations: 90, // 🔢 hermes-agent default
      wallClockTimeoutMs: 20 * 60 * 1000, // 🔢 20 min
      creditBudget: 8000, // 🔢 ~$8 raw cost per task
    },
    toolsets: [...ALL_GATEABLE_TOOLSETS], // 🔢 locked grill-me 2026-06-20 — everything unlocked
  },
};

// Free trial grant (Q22) — small one-time credit balance on first
// provisioning, no card required. ~2-3 demo tasks at Starter-tier cost.
export const FREE_TRIAL_CREDITS = 1500; // 🔢 ~$1.50 raw model cost

export function tierConfig(planTier: string | null | undefined): TierConfig {
  return TIERS[(planTier as PlanTier) ?? "starter"] ?? TIERS.starter;
}

// --- Credit <-> USD conversion -------------------------------------------
// 1 credit = $0.001 raw OpenRouter cost (pre-markup).

export function creditsForUsd(usd: number): number {
  return usd * 1000;
}

export function usdForCredits(credits: number): number {
  return credits / 1000;
}

// --- Pre-task credit estimate (item 1) ------------------------------------
//
// Rough token-budget heuristic: assume a task may consume up to
// `ESTIMATE_TOKEN_BUDGET` total tokens (prompt + completion, summed across
// all iterations) at the tier model's OpenRouter list price. This is a
// conservative ceiling, not a precise forecast — it exists only to reject
// requests a customer clearly cannot afford before any spend happens.
//
// Per-iteration budget scales with the tier's maxIterations cap so a
// Business task (90 iterations) gets a proportionally larger estimate than
// a Starter task (40 iterations).
const TOKENS_PER_ITERATION_ESTIMATE = 4000; // 🔢 prompt+completion tokens/iteration, rough

export interface ModelPriceUsdPerMTok {
  prompt: number;
  completion: number;
}

// Fallback list prices (USD per 1M tokens) used when OpenRouter's live
// pricing isn't fetched. 🔢 keep roughly in sync with OpenRouter's
// /api/v1/models pricing for the model IDs above.
export const FALLBACK_MODEL_PRICES: Record<string, ModelPriceUsdPerMTok> = {
  "anthropic/claude-haiku-4.5": { prompt: 1, completion: 5 },
  "anthropic/claude-sonnet-4.5": { prompt: 3, completion: 15 },
  "anthropic/claude-opus-4.1": { prompt: 15, completion: 75 },
};

export function estimateTaskCreditCost(tier: PlanTier): number {
  const cfg = TIERS[tier];
  const prices = FALLBACK_MODEL_PRICES[cfg.model] ?? FALLBACK_MODEL_PRICES["anthropic/claude-sonnet-4.5"];
  const totalTokens = cfg.caps.maxIterations * TOKENS_PER_ITERATION_ESTIMATE;
  // Assume a 1:1 prompt/completion split for the rough ceiling.
  const avgPricePerMTok = (prices.prompt + prices.completion) / 2;
  const usd = (totalTokens / 1_000_000) * avgPricePerMTok;
  return Math.ceil(creditsForUsd(usd) * cfg.markup);
}

// Budget-exceeded margin (item 2b): if mid-stream actual usage exceeds the
// pre-task estimate by this factor, the gateway cuts the stream and surfaces
// "budget exceeded, continue?" rather than letting the task run unbounded.
export const BUDGET_EXCEEDED_MARGIN = 1.5; // 🔢 i.e. 150% of estimate

// --- Usage display (A1) ----------------------------------------------------
//
// `hermes_registry` has no stored monthly-reset timestamp — billing here is a
// running Supabase credit_balance, not a calendar-cycle subscription record.
// usedPercent is derived from the tier's `monthlyCredits` denominator (the
// same shape as hermes-agent's own CreditsState.used_fraction); resetAt is
// synthesized as the 1st of next calendar month (UTC) as a placeholder cycle
// boundary until a real billing-cycle column exists.
export function usedPercentForTier(planTier: string | null | undefined, creditBalance: number): number {
  const cfg = tierConfig(planTier);
  if (cfg.monthlyCredits <= 0) return 0;
  const used = Math.max(0, cfg.monthlyCredits - creditBalance);
  return Math.max(0, Math.min(100, (used / cfg.monthlyCredits) * 100));
}

export function nextMonthlyResetAt(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}
