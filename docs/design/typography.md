# Fluxpoint Typography

Fluxpoint typography is centralized in `src/lib/design/typography.ts`. Update that file first when changing font families, CSS variables, or `next/font/google` configuration. Update `tailwind.config.ts` only when semantic Tailwind token mappings need to change.

## Active fonts

- Display / headings: Instrument Serif, falling back to Georgia, Cambria, `"Times New Roman"`, serif.
- Body / UI: Inter, falling back to system-ui, -apple-system, BlinkMacSystemFont, `"Segoe UI"`, sans-serif.
- Metrics / technical: IBM Plex Mono, falling back to `"SFMono-Regular"`, `"Roboto Mono"`, Consolas, `"Liberation Mono"`, monospace.

## Tailwind tokens

- `font-display`: use for marketing hero headlines, page titles, section titles, generated tank names, dashboard tank names, and empty-state headlines.
- `font-sans`: default app font for body copy, navigation, buttons, forms, labels, tables, cards, dialogs, settings, descriptions, and helper text.
- `font-mono`: use for water readings, sensor values, timestamps, QR payloads, equipment serial numbers, server/build labels, Prometheus metric names, intentional database IDs, and short technical badges such as pH, TDS, NTU, F, and ppm.

## Usage notes

Keep Inter as the functional default. Instrument Serif should be an identity accent for titles and names, not long paragraphs, buttons, forms, dense tables, or navigation. IBM Plex Mono should mark concise technical data and readings rather than ordinary prose.

The root layout applies the font variables globally through `typographyClassName`, and Tailwind maps `fontFamily.display`, `fontFamily.sans`, and `fontFamily.mono` to those CSS variables with fallback stacks.
