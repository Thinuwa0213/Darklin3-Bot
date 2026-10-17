import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

// Ensure root .env is loaded in development if running inside apps/web workspace
const rootEnvPath = path.resolve(__dirname, "../../.env");
if (!process.env.API_INTERNAL_URL && fs.existsSync(rootEnvPath)) {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch {
    // Ignore if already loaded
  }
}

/**
 * Minimal Phase 2 foundation config — no product-specific settings yet.
 */
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
  async rewrites() {
    const apiInternalUrl = process.env.API_INTERNAL_URL || "http://localhost:8787";
    return [
      {
        source: "/storage/:path*",
        destination: `${apiInternalUrl}/storage/:path*`,
      },
    ];
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
