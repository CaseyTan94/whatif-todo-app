import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // Cache Components is off: @ant-design/cssinjs (used by AntdRegistry) calls
  // Math.random() during render, which Cache Components rejects at prerender.
  // This app is fully client-side (localStorage), so there's nothing to cache.
  // partialPrefetching requires cacheComponents, so it's removed too.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
