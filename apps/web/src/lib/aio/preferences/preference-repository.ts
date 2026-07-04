import type { SupabaseClient } from "@supabase/supabase-js";

export const PREFERENCE_REPO_ERROR_CODE = {
  DB_ERROR: "DB_ERROR",
} as const;

export type PreferenceRepoErrorCode =
  (typeof PREFERENCE_REPO_ERROR_CODE)[keyof typeof PREFERENCE_REPO_ERROR_CODE];

export type PreferenceRepoError = {
  ok: false;
  code: PreferenceRepoErrorCode;
  message: string;
};

export type PreferenceRepoOk<T> = { ok: true; data: T };
export type PreferenceRepoResult<T> = PreferenceRepoOk<T> | PreferenceRepoError;

export type UserPreferences = {
  notifyDiscordGlobal: boolean;
  dataTrainingOptOut: boolean;
};

interface UserPreferencesRow {
  customer_id: string;
  notify_discord_global: boolean;
  data_training_opt_out: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  notifyDiscordGlobal: true,
  dataTrainingOptOut: false,
};

function dbError(message: string, detail?: unknown): PreferenceRepoError {
  return {
    ok: false,
    code: PREFERENCE_REPO_ERROR_CODE.DB_ERROR,
    message: detail ? `${message}: ${JSON.stringify(detail)}` : message,
  };
}

function rowToPreferences(row: UserPreferencesRow): UserPreferences {
  return {
    notifyDiscordGlobal: row.notify_discord_global,
    dataTrainingOptOut: row.data_training_opt_out,
  };
}

export async function getPreferences(
  db: SupabaseClient,
  customerId: string,
): Promise<PreferenceRepoResult<UserPreferences>> {
  const { data, error } = await db
    .from("aio_user_preferences")
    .select("*")
    .eq("customer_id", customerId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No row found, return defaults
      return { ok: true, data: DEFAULT_PREFERENCES };
    }
    return dbError("Failed to get preferences", error.message);
  }

  return { ok: true, data: rowToPreferences(data as UserPreferencesRow) };
}

export async function upsertPreferences(
  db: SupabaseClient,
  customerId: string,
  patch: Partial<UserPreferences>,
): Promise<PreferenceRepoResult<UserPreferences>> {
  const updateData: Record<string, boolean> = {};
  if (patch.notifyDiscordGlobal !== undefined) {
    updateData.notify_discord_global = patch.notifyDiscordGlobal;
  }
  if (patch.dataTrainingOptOut !== undefined) {
    updateData.data_training_opt_out = patch.dataTrainingOptOut;
  }

  const { data, error } = await db
    .from("aio_user_preferences")
    .upsert({
      customer_id: customerId,
      ...updateData,
    })
    .select("*")
    .single();

  if (error) return dbError("Failed to upsert preferences", error.message);
  return { ok: true, data: rowToPreferences(data as UserPreferencesRow) };
}