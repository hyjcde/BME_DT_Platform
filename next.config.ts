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
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
} as any;

export default nextConfig;
