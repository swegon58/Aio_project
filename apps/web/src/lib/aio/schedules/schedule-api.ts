import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isProductionDeployment } from "@/lib/aio/config/production-guard.mjs";
import { getRegistryRow } from "@/lib/hermes/registry";
import { type PlanTier, tierConfig } from "@/lib/hermes/pricing";
import type { ScheduleRepoError } from "./schedule-repository";

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

export interface ScheduleApiContext {
  db: ReturnType<typeof createServiceClient>;
  userId: string;
  planTier: PlanTier;
}

export async function resolveScheduleApiContext(): Promise<
  { ok: true; ctx: ScheduleApiContext } | { ok: false; response: Response }
> {
  if (isProductionDeployment() && DEV_BYPASS) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "unsafe_configuration",
          message: "Development auth bypass is disabled in production.",
        },
        { status: 500 },
      ),
    };
  }

  if (DEV_BYPASS) {
    return {
      ok: true,
      ctx: {
        db: createServiceClient(),
        userId: DEV_USER_ID,
        planTier: "pro",
      },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "unauthorized", message: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const db = createServiceClient();
  const row = await getRegistryRow(db, user.id).catch(() => null);
  const planTier = (row?.plan_tier as PlanTier | undefined) ?? "starter";

  return {
    ok: true,
    ctx: {
      db,
      userId: user.id,
      planTier,
    },
  };
}

export function requireCronAccess(planTier: PlanTier): Response | null {
  if (!tierConfig(planTier).toolsets.includes("cronjob")) {
    return Response.json(
      {
        error: "plan_locked",
        message: "Scheduled tasks require the Business plan.",
      },
      { status: 403 },
    );
  }
  return null;
}

export function scheduleRepoErrorResponse(error: ScheduleRepoError): Response {
  const status =
    error.code === "SCHEDULE_NOT_FOUND"
      ? 404
      : error.code === "INVALID_SCHEDULE"
        ? 400
        : error.code === "DUPLICATE_RUN"
          ? 409
          : 500;

  return Response.json(
    {
      error: error.code.toLowerCase(),
      code: error.code,
      message: error.message,
    },
    { status },
  );
}
