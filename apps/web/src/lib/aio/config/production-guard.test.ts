import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProductionEnvironment,
  isProductionDeployment,
  productionEnvironmentErrors,
} from "./production-guard.mjs";

const safeProductionEnv = {
  AIO_DEPLOYMENT_ENV: "production",
  NEXT_PUBLIC_DEV_AUTH_BYPASS: "false",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  PADDLE_API_KEY: "paddle",
  PADDLE_WEBHOOK_SECRET: "webhook",
  PADDLE_PRICE_ID_STARTER: "pri_starter",
  PADDLE_PRICE_ID_PRO: "pri_pro",
  PADDLE_PRICE_ID_BUSINESS: "pri_business",
  PADDLE_PRICE_ID_TOPUP: "pri_topup",
};

test("does not enforce hosted secrets in development", () => {
  assert.equal(isProductionDeployment({ AIO_DEPLOYMENT_ENV: "development" }), false);
  assert.equal(
    isProductionDeployment({ AIO_DEPLOYMENT_ENV: "development", NODE_ENV: "production" }),
    false,
  );
  assert.deepEqual(productionEnvironmentErrors({}), []);
});

test("accepts explicit, Vercel, and Node production environments", () => {
  assert.equal(isProductionDeployment(safeProductionEnv), true);
  assert.equal(isProductionDeployment({ VERCEL_ENV: "production" }), true);
  assert.equal(isProductionDeployment({ NODE_ENV: "production" }), true);
  assert.equal(
    isProductionDeployment({ VERCEL_ENV: "preview", NODE_ENV: "production" }),
    false,
  );
  assert.doesNotThrow(() => assertProductionEnvironment(safeProductionEnv));
});

test("rejects development bypasses and missing production services", () => {
  const errors = productionEnvironmentErrors({
    AIO_DEPLOYMENT_ENV: "production",
    NEXT_PUBLIC_DEV_AUTH_BYPASS: "true",
    HERMES_DEV_API_SERVER_KEY: "dev-key",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  });

  assert.ok(errors.includes("NEXT_PUBLIC_DEV_AUTH_BYPASS must be false in production."));
  assert.ok(errors.includes("HERMES_DEV_API_SERVER_KEY is development-only."));
  assert.ok(errors.includes("PADDLE_API_KEY is required in production."));
  assert.ok(errors.includes("NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production."));
  assert.ok(errors.includes("NEXT_PUBLIC_SUPABASE_URL cannot target localhost in production."));
  assert.throws(
    () =>
      assertProductionEnvironment({
        AIO_DEPLOYMENT_ENV: "production",
        NEXT_PUBLIC_DEV_AUTH_BYPASS: "true",
      }),
    /Unsafe Aio production configuration/,
  );
});
