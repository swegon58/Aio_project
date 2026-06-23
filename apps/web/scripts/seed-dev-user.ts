#!/usr/bin/env node
/**
 * Creates the fixed dev-bypass auth.users row (id=00000000-0000-0000-0000-000000000001)
 * used by request-context.ts when NEXT_PUBLIC_DEV_AUTH_BYPASS=true. Without this row,
 * any FK to auth.users (e.g. hermes_conversations.customer_id) silently fails on write.
 *
 * Usage: npx tsx scripts/seed-dev-user.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase.auth.admin.getUserById(DEV_USER_ID);
  if (existing?.user) {
    console.log("Dev user already exists:", existing.user.id);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    id: DEV_USER_ID,
    email: "dev-bypass@aio.local",
    email_confirm: true,
    user_metadata: { dev_bypass: true },
  });

  if (error) {
    console.error("FAIL:", error.message);
    process.exit(1);
  }
  console.log("Created dev user:", data.user?.id);
}

main();
