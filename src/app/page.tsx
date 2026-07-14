import type { Metadata } from "next";
import { WetlabsSplashPage } from "@/components/marketing/wetlabs/WetlabsSplashPage";

const wetlabsUrl = "https://www.wetlabs.dev";
const description = "Wetlabs makes practical tools for careful records, living systems, collections, and change over time.";

export const metadata: Metadata = {
  metadataBase: new URL(wetlabsUrl),
  title: { absolute: "Wetlabs" },
  description,
  applicationName: "Wetlabs",
  manifest: null,
  appleWebApp: null,
  alternates: { canonical: wetlabsUrl },
  icons: {
    icon: [{ url: "/wetlabs/brand/wetlabs-mark.png", sizes: "256x256", type: "image/png" }],
    shortcut: ["/wetlabs/brand/wetlabs-mark.png"],
    apple: [{ url: "/wetlabs/brand/wetlabs-mark.png", sizes: "256x256", type: "image/png" }]
  },
  openGraph: {
    title: "Wetlabs",
    description,
    url: wetlabsUrl,
    siteName: "Wetlabs",
    type: "website",
    images: [{ url: "/wetlabs/brand/wetlabs-og.jpg", width: 1200, height: 630, alt: "Wetlabs — wet hands, quiet mind" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Wetlabs",
    description,
    images: ["/wetlabs/brand/wetlabs-og.jpg"]
  }
};

export default function Home() {
  return <WetlabsSplashPage />;
}
