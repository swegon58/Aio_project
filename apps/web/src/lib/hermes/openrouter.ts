// Aio x Hermes - per-customer OpenRouter key provisioning (Q15/Q41).
//
// Uses OpenRouter's Provisioning API (https://openrouter.ai/docs/features/provisioning-api-keys)
// to create a scoped API key per customer with a hard monthly spend ceiling
// (Q15 provider-level cap, on top of Q16 prepaid balance + Q17 per-task caps).
//
// Requires `OPENROUTER_PROVISIONING_KEY` in Aio's server env (Aio/.env.local)
// — a top-level "Provisioning API key" from openrouter.ai/settings/provisioning-keys,
// distinct from the regular `OPENROUTER_API_KEY` used for chat completions.
// If unset, `provisionOpenRouterKey` returns null and callers MUST fall back
// to the shared dev key (Phase-1 placeholder behavior).

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

export interface ProvisionedOpenRouterKey {
  /** Raw key (e.g. `sk-or-v1-...`) — caller writes to profile `.env`, then discards. */
  key: string;
  /** OpenRouter's key hash/id — useful for later update/delete calls. Not secret. */
  hash: string;
}

// Creates a new per-customer OpenRouter API key with a hard monthly spend
// limit (USD, raw cost). Returns null (no-op) if OPENROUTER_PROVISIONING_KEY
// is not configured — callers must fall back to the shared dev key.
export async function provisionOpenRouterKey(
  profileName: string,
  spendLimitUsd: number,
): Promise<ProvisionedOpenRouterKey | null> {
  const provisioningKey = process.env.OPENROUTER_PROVISIONING_KEY;
  if (!provisioningKey) {
    console.warn(
      `[openrouter] OPENROUTER_PROVISIONING_KEY not set — falling back to shared dev OPENROUTER_API_KEY for profile "${profileName}". Per-customer spend ceilings (Q15) are NOT active.`,
    );
    return null;
  }

  const res = await fetch(`${OPENROUTER_API_BASE}/keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provisioningKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `aio-${profileName}`,
      limit: spendLimitUsd,
      limit_reset: "monthly",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter key provisioning failed for profile "${profileName}" (${res.status}): ${body}`,
    );
  }

  const json = (await res.json()) as { key: string; data: { hash: string } };
  return { key: json.key, hash: json.data.hash };
}

// Updates the spend limit of an existing per-customer OpenRouter key — used
// when a customer changes plan tier (Q34 model swap already handled in
// applyTierConfig; this keeps the Q15 ceiling in sync).
export async function updateOpenRouterKeyLimit(
  keyHash: string,
  spendLimitUsd: number,
): Promise<void> {
  const provisioningKey = process.env.OPENROUTER_PROVISIONING_KEY;
  if (!provisioningKey) return;

  const res = await fetch(`${OPENROUTER_API_BASE}/keys/${keyHash}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${provisioningKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit: spendLimitUsd, limit_reset: "monthly" }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter key limit update failed (${res.status}): ${body}`);
  }
}
