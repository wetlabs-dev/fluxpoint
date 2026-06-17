export const siteConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  marketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000/fluxpoint",
  donateUrl: process.env.NEXT_PUBLIC_DONATE_URL ?? "https://ko-fi.com/wetlabs",
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/wetlabs-dev/fluxpoint",
  siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Fluxpoint",
  title: "Fluxpoint — Aquarium Management for Living Systems",
  description:
    "Track aquariums, stocking, equipment, maintenance, water parameters, workflows, and sensor-driven insights in one soft, modern dashboard."
};

export function absoluteAppUrl(path = "/") {
  return new URL(path, siteConfig.appUrl).toString();
}

export function absoluteMarketingUrl(path = "") {
  return new URL(path, siteConfig.marketingUrl).toString();
}

export function wetlabsUrl(path = "/") {
  return new URL(path, siteConfig.marketingUrl).toString();
}
