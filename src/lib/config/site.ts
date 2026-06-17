export const siteConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  marketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000/marketing-preview",
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
