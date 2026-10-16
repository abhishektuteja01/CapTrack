import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CSV imports send every previewed row in one action call.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
