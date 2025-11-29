import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable turbopack with empty config
  turbopack: {},
  // Transpile cesium and resium
  transpilePackages: ["cesium", "resium"],
  // Ignore webpack configuration for Turbopack
  experimental: {
    // Enable server actions if needed
  },
};

export default nextConfig;
