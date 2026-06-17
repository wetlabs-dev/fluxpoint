import type { Metadata } from "next";
import { FluxpointSplashPage } from "@/components/marketing/FluxpointSplashPage";
import { siteConfig } from "@/lib/config/site";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
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
      siteName: "Wetlabs",
      type: "website"
    }
  };
}

export default function FluxpointMarketingPage() {
  return <FluxpointSplashPage />;
}
