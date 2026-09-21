import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure pg is bundled properly in serverless environments
  serverExternalPackages: ["pg"],

  // Strip X-Powered-By header to reduce response byte overhead and hide server tech
  poweredByHeader: false,

  // Enable gzip & brotli compression for static and dynamic responses
  compress: true,

  // Custom HTTP headers for performance and security
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // Static favicon and public assets
        source: "/(favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff|woff2))",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
