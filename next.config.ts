import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["nodemailer"],
  outputFileTracingExcludes: {
    "/*": [
      "./.next/cache/**",
      "./backups/**",
      "./coverage/**",
      "./logs/**",
      "./playwright-report/**",
      "./public/labels/**",
      "./public/uploads/**",
      "./test-results/**",
      "./tmp/**"
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
