import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  allowedDevOrigins: ["192.168.1.15", "*.trycloudflare.com"],
  devIndicators: false,
};

export default nextConfig;
