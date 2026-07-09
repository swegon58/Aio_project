import type { NextConfig } from "next";
import { assertProductionEnvironment } from "./src/lib/aio/config/production-guard.mjs";

assertProductionEnvironment();

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  allowedDevOrigins: ["192.168.1.5", "*.trycloudflare.com"],
  devIndicators: false,
  // ponytail: separate distDir only under AIO_E2E (Playwright), so the e2e dev
  // server compiles into .next-e2e instead of colliding with the always-on
  // aio-app.service `next dev` in .next. Service unset env -> default .next.
  distDir: process.env.AIO_E2E ? ".next-e2e" : undefined,
};

export default nextConfig;
