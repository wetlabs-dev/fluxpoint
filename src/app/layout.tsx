import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/lib/config/site";
import { typographyClassName } from "@/lib/design/typography";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";
import { PwaRegistrar } from "@/components/pwa/PwaRegistrar";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.appUrl),
  title: {
    default: siteConfig.siteName,
    template: `%s · ${siteConfig.siteName}`
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  applicationName: "Fluxpoint",
  appleWebApp: { capable: true, title: "Fluxpoint", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/app-icon-1024.png", sizes: "1024x1024", type: "image/png" }
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4fbfb" },
    { media: "(prefers-color-scheme: dark)", color: "#082f35" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={typographyClassName} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider><PwaRegistrar />{children}</ThemeProvider>
      </body>
    </html>
  );
}
