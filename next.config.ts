import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployments (Railway, etc.)
  output: "standalone",
};

export default nextConfig;
