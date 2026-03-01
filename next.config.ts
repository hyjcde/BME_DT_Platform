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
  // eslint 已从 next.config 移除，请使用 ESLint CLI：npm run lint / next lint
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
} as any;

export default nextConfig;
