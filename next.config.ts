import type { NextConfig } from "next";

const skipBuildChecks = process.env.NEXT_SKIP_BUILD_CHECKS === "true";

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: skipBuildChecks
  },
  typescript: {
    ignoreBuildErrors: skipBuildChecks
  },
  serverExternalPackages: ["nodemailer"],
  async rewrites() {
    return [
      {
        source: "/fluxpoint/brand/:path*",
        destination: "/brand/:path*"
      }
    ];
  },
  outputFileTracingExcludes: {
    "/*": [
      "./.git/**",
      "./.next/cache/**",
      "./backups/**",
      "./coverage/**",
      "./docs/**/*.jpg",
      "./docs/**/*.jpeg",
      "./docs/**/*.pdf",
      "./docs/**/*.png",
      "./docs/**/*.webp",
      "./logs/**",
      "./playwright-report/**",
      "./public/labels/**",
      "./public/uploads/**",
      "./test-results/**",
      "./tmp/**",
      "./tsconfig.tsbuildinfo"
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
