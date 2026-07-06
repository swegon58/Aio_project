import type { NextConfig } from "next";
import { assertProductionEnvironment } from "./src/lib/aio/config/production-guard.mjs";

assertProductionEnvironment();

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  allowedDevOrigins: ["192.168.1.5", "*.trycloudflare.com"],
  devIndicators: false,
};

export default nextConfig;
