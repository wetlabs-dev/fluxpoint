import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["nodemailer"],
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
