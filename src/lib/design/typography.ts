import { Cabin, IBM_Plex_Mono, Inter, Playfair_Display, Source_Sans_3 } from "next/font/google";

export const fontVariables = {
  display: "--font-display",
  sans: "--font-sans",
  mono: "--font-mono"
} as const;

export const fontFamilies = {
  display: `var(${fontVariables.display}), Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  sans: `var(${fontVariables.sans}), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  mono: `var(${fontVariables.mono}), "SFMono-Regular", "Roboto Mono", Consolas, "Liberation Mono", monospace`
} as const;

// Display: hero headlines, page titles, section titles, and generated tank names.
export const displayFont = Cabin({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap"
});

// Sans: body copy, navigation, buttons, forms, tables, cards, and dense UI.
export const sansFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

// Mono: readings, metrics, timestamps, QR payloads, serials, IDs, and technical labels.
export const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap"
});

// Wetlabs has its own editorial type system. These variables are applied only
// inside the public Wetlabs surface so Fluxpoint's established typography stays intact.
export const wetlabsDisplayFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-wetlabs-display",
  display: "swap"
});

export const wetlabsBodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-wetlabs-body",
  display: "swap"
});

export const typographyClassName = `${displayFont.variable} ${sansFont.variable} ${monoFont.variable} font-sans`;
export const wetlabsTypographyClassName = `${wetlabsDisplayFont.variable} ${wetlabsBodyFont.variable} ${sansFont.variable}`;
