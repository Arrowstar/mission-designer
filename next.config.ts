import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // nlopt-js uses fs for WASM loading in Node, but we only run it client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  // Disable Turbopack (use Webpack for better fallback support)
  // This is handled by not using --turbopack flag
};

export default nextConfig;
