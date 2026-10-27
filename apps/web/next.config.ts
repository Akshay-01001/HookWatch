import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Allow importing TypeScript source from workspace packages
  transpilePackages: ["@hook-watch/database", "@hook-watch/queue"],
  // Use Node.js runtime for server-side features (Prisma, ioredis, BullMQ)
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "ioredis", "bullmq"],
};

export default nextConfig;
