import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Draft-card share images read soldier frames + the pixel font from disk
  outputFileTracingIncludes: {
    "/d/*/opengraph-image": ["./assets/**/*"],
  },
  // Raw 1116px source art stays out of server bundles (the site serves /public/swole)
  outputFileTracingExcludes: {
    "/*": ["./public/gif_and_metadata/**/*"],
  },
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
