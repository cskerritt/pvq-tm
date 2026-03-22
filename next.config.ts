import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployments (Railway, etc.)
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/data-sync",
        destination: "/admin/data-sync",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
