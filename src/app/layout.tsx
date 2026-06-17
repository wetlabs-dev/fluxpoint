import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";
import { typographyClassName } from "@/lib/design/typography";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.appUrl),
  title: {
    default: siteConfig.siteName,
    template: `%s · ${siteConfig.siteName}`
  },
  description: siteConfig.description,
  alternates: {
    canonical: siteConfig.appUrl
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.appUrl,
    siteName: siteConfig.siteName,
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={typographyClassName} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
