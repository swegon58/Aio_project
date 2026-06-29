import {
  getOrCreateThreadSession,
  getRegistryRow,
  serviceDb,
  type HermesRegistryRow,
} from "@/lib/hermes/registry";
import { ensureRunning, touchRegistryRow } from "@/lib/hermes/lifecycle";
import type { PlanTier } from "@/lib/hermes/pricing";
import type { HermesRequestContext } from "@/lib/hermes/request-context";
import { isProductionDeployment } from "@/lib/aio/config/production-guard.mjs";

function resolveApiServerKey(row: HermesRegistryRow): string {
  if (!row.endpoint || !row.api_server_key_ref) {
    throw new Error("Hermes process not ready");
  }

  if (row.api_server_key_ref.startsWith("inline:")) {
    if (isProductionDeployment()) {
      throw new Error("Unsafe configuration: inline runtime keys are disabled in production");
    }
    return row.api_server_key_ref.slice("inline:".length);
  }

  if (row.api_server_key_ref === "env:HERMES_DEV_API_SERVER_KEY") {
    if (isProductionDeployment()) {
      throw new Error("Unsafe configuration: development runtime keys are disabled in production");
    }
    const apiServerKey = process.env.HERMES_DEV_API_SERVER_KEY;
    if (!apiServerKey) {
      throw new Error("Server misconfigured: no API server key resolved");
    }
    return apiServerKey;
  }

  throw new Error("Server misconfigured: unsupported API server key reference");
}

export async function resolveHermesBackgroundContext(input: {
  customerId: string;
  threadId: string;
}): Promise<HermesRequestContext> {
  const db = serviceDb();

  const existing = await getRegistryRow(db, input.customerId);
  if (!existing) {
    throw new Error(`Hermes registry row missing for customer ${input.customerId}`);
  }

  const row = await ensureRunning(db, existing);
  const apiServerKey = resolveApiServerKey(row);
  const thread = await getOrCreateThreadSession(db, input.customerId, input.threadId);
  await touchRegistryRow(db, input.customerId);

  return {
    db,
    userId: input.customerId,
    row,
    planTier: (row.plan_tier as PlanTier) ?? "starter",
    apiServerKey,
    hermesSessionId: thread.session_id,
    threadId: input.threadId,
  };
}
