import { IBM_Plex_Mono, Instrument_Serif, Inter } from "next/font/google";

export const fontVariables = {
  display: "--font-display",
  sans: "--font-sans",
  mono: "--font-mono"
} as const;

export const fontFamilies = {
  display: `var(${fontVariables.display}), Georgia, Cambria, "Times New Roman", serif`,
  sans: `var(${fontVariables.sans}), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  mono: `var(${fontVariables.mono}), "SFMono-Regular", "Roboto Mono", Consolas, "Liberation Mono", monospace`
} as const;

// Display: hero headlines, page titles, section titles, and generated tank names.
export const displayFont = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
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

export const typographyClassName = `${displayFont.variable} ${sansFont.variable} ${monoFont.variable} font-sans`;
