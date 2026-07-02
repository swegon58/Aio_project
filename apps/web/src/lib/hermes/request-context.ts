import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  ensureRegistryRow,
  getOrCreateThreadSession,
  serviceDb,
  type HermesRegistryRow,
} from "@/lib/hermes/registry";
import { ensureRunning, touchRegistryRow } from "@/lib/hermes/lifecycle";
import { type PlanTier } from "@/lib/hermes/pricing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isProductionDeployment } from "@/lib/aio/config/production-guard.mjs";
import { isBetaInviteOnlyEnabled, isEmailInvited } from "@/lib/aio/security/invite-gate";

export const THREAD_COOKIE = "hermes_thread_id";

export interface HermesRequestContext {
  db: SupabaseClient;
  userId: string;
  row: HermesRegistryRow;
  planTier: PlanTier;
  apiServerKey: string;
  hermesSessionId: string;
  threadId: string;
}

export type HermesRequestContextResult =
  | { ok: true; ctx: HermesRequestContext }
  | { ok: false; res: Response };

// Shared auth + provisioning + key-resolution boundary for all /api/chat/*
// routes (BUILD_SPEC §4/§6). Resolves the authenticated user, ensures the
// customer's Hermes process is running, resolves the api_server_key, and
// looks up the per-thread Hermes Session-Id. Does not touch billing —
// callers that proxy a run (chat/route.ts) handle credit checks themselves.
const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function resolveHermesRequestContext(): Promise<HermesRequestContextResult> {
  if (isProductionDeployment() && DEV_BYPASS) {
    return {
      ok: false,
      res: new Response("Unsafe configuration: development auth bypass is disabled in production", { status: 500 }),
    };
  }
  if (DEV_BYPASS) {
    const apiServerKey = process.env.HERMES_DEV_API_SERVER_KEY;
    if (!apiServerKey) {
      return { ok: false, res: new Response("Dev bypass: HERMES_DEV_API_SERVER_KEY not set", { status: 500 }) };
    }
    const devRow: HermesRegistryRow = {
      customer_id: DEV_USER_ID,
      profile_name: "aio",
      port: 8642,
      endpoint: "http://127.0.0.1:8642",
      status: "running",
      api_server_key_ref: `inline:${apiServerKey}`,
      openrouter_key_ref: null,
      openrouter_key_hash: null,
      commit_pin: null,
      pid: null,
      last_active_at: new Date().toISOString(),
      normalized_email: "dev@local",
      credit_balance: 9999,
      plan_tier: "pro",
      free_grant_used: true,
      onboarded_at: new Date().toISOString(),
      activated_at: new Date().toISOString(),
    };
    const cookieStore = await cookies();
    let threadId = cookieStore.get(THREAD_COOKIE)?.value;
    if (!threadId) {
      threadId = randomUUID();
      cookieStore.set(THREAD_COOKIE, threadId, { httpOnly: true, sameSite: "lax" });
    }
    return {
      ok: true,
      ctx: {
        db: serviceDb(),
        userId: DEV_USER_ID,
        row: devRow,
        planTier: "pro",
        apiServerKey,
        hermesSessionId: `dev-session-${threadId}`,
        threadId,
      },
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, res: new Response("Unauthorized", { status: 401 }) };
  }

  const db = serviceDb();

  if (isBetaInviteOnlyEnabled()) {
    const invited = await isEmailInvited(db, user.email ?? `${user.id}@unknown.local`);
    if (!invited) {
      return {
        ok: false,
        res: Response.json(
          { error: "beta_invite_required", message: "Aio is invite-only right now." },
          { status: 403 },
        ),
      };
    }
  }

  let row: HermesRegistryRow;
  try {
    row = await ensureRegistryRow(db, user.id, user.email ?? `${user.id}@unknown.local`);
    row = await ensureRunning(db, row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, res: new Response(`Hermes provisioning failed: ${msg}`, { status: 500 }) };
  }

  if (!row.endpoint || !row.api_server_key_ref) {
    return { ok: false, res: new Response("Hermes process not ready", { status: 503 }) };
  }

  let apiServerKey: string | undefined;
  if (row.api_server_key_ref.startsWith("inline:")) {
    if (isProductionDeployment()) {
      return {
        ok: false,
        res: new Response("Unsafe configuration: inline runtime keys are disabled in production", { status: 500 }),
      };
    }
    apiServerKey = row.api_server_key_ref.slice("inline:".length);
  } else if (row.api_server_key_ref === "env:HERMES_DEV_API_SERVER_KEY") {
    if (isProductionDeployment()) {
      return {
        ok: false,
        res: new Response("Unsafe configuration: development runtime keys are disabled in production", { status: 500 }),
      };
    }
    apiServerKey = process.env.HERMES_DEV_API_SERVER_KEY;
  }
  if (!apiServerKey) {
    return { ok: false, res: new Response("Server misconfigured: no API server key resolved", { status: 500 }) };
  }

  const cookieStore = await cookies();
  let threadId = cookieStore.get(THREAD_COOKIE)?.value;
  if (!threadId) {
    threadId = randomUUID();
    cookieStore.set(THREAD_COOKIE, threadId, { httpOnly: true, sameSite: "lax" });
  }

  let hermesSessionId: string;
  try {
    const thread = await getOrCreateThreadSession(db, user.id, threadId);
    hermesSessionId = thread.session_id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, res: new Response(`Thread session lookup failed: ${msg}`, { status: 500 }) };
  }

  await touchRegistryRow(db, user.id);

  return {
    ok: true,
    ctx: {
      db,
      userId: user.id,
      row,
      planTier: (row.plan_tier as PlanTier) ?? "starter",
      apiServerKey,
      hermesSessionId,
      threadId,
    },
  };
}
