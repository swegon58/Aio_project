const REQUIRED_PRODUCTION_SECRETS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "PADDLE_PRICE_ID_STARTER",
  "PADDLE_PRICE_ID_PRO",
  "PADDLE_PRICE_ID_BUSINESS",
  "PADDLE_PRICE_ID_TOPUP",
];

/**
 * @param {Record<string, string | undefined>} env
 */
export function isProductionDeployment(env = process.env) {
  if (env.AIO_DEPLOYMENT_ENV) {
    return env.AIO_DEPLOYMENT_ENV === "production";
  }
  if (env.VERCEL_ENV) {
    return env.VERCEL_ENV === "production";
  }
  return env.NODE_ENV === "production";
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function productionEnvironmentErrors(env) {
  if (!isProductionDeployment(env)) return [];

  const errors = [];
  if (env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    errors.push("NEXT_PUBLIC_DEV_AUTH_BYPASS must be false in production.");
  }
  if (env.HERMES_DEV_API_SERVER_KEY?.trim()) {
    errors.push("HERMES_DEV_API_SERVER_KEY is development-only.");
  }

  for (const name of REQUIRED_PRODUCTION_SECRETS) {
    if (!env[name]?.trim()) errors.push(`${name} is required in production.`);
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol !== "https:") {
        errors.push("NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production.");
      }
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        errors.push("NEXT_PUBLIC_SUPABASE_URL cannot target localhost in production.");
      }
    } catch {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
    }
  }

  return errors;
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function assertProductionEnvironment(env = process.env) {
  const errors = productionEnvironmentErrors(env);
  if (errors.length > 0) {
    throw new Error(`Unsafe Aio production configuration:\n- ${errors.join("\n- ")}`);
  }
}
