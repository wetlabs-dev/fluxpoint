import type { Metadata } from "next";
import { FluxpointSplashPage } from "@/components/marketing/FluxpointSplashPage";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.marketingUrl),
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: {
    canonical: siteConfig.marketingUrl
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.marketingUrl,
    siteName: siteConfig.siteName,
    type: "website"
  }
};

export default function MarketingPreviewPage() {
  return <FluxpointSplashPage />;
}
