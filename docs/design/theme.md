# Fluxpoint Theme System

Fluxpoint uses class-based Tailwind dark mode for authenticated app routes. The public splash page is intentionally light-only.

## How Switching Works

- The root layout renders an inline theme script before hydration to reduce flicker.
- `ThemeProvider` stores the user choice in `localStorage` under `fluxpoint-theme`.
- Supported app choices are `light`, `dark`, and `system`.
- `system` follows `prefers-color-scheme` and updates when the OS preference changes.
- `ThemeToggle` is available in the authenticated app shell and in Settings > Appearance.
- On narrow screens, appearance, account settings, and logout live in the compact top-right account menu; the full account footer remains desktop-only.

## App Tokens

Global app color tokens live in `src/app/globals.css`, and Tailwind maps them in `tailwind.config.ts`.

Core app tokens include:

- `background`, `foreground`
- `card`, `card-foreground`
- `popover`, `popover-foreground`
- `primary`, `primary-foreground`
- `secondary`, `secondary-foreground`
- `muted`, `muted-foreground`
- `accent`, `accent-foreground`
- `destructive`, `destructive-foreground`
- `border`, `input`, `ring`
- Fluxpoint accents: `moss`, `sand`, `water`

Use semantic classes such as `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `border-border`, `bg-muted`, `text-muted-foreground`, `bg-primary`, and `text-primary-foreground`. Avoid app-only hard-coded light colors such as `bg-white`, `text-slate-900`, or `border-slate-200`.

## Palette Overview

Light mode uses warm ivory backgrounds, deep teal/navy text, moss, sand, and soft water accents.

Dark mode uses deep aquatic navy, blue-green charcoal cards, muted teal-gray borders, warm ivory foreground text, seafoam muted text, soft aqua primary actions, muted sand accents, and soft coral destructive states.

## Light-Only Splash Page

The public `/fluxpoint` page and `/marketing-preview` are fixed light-mode brand surfaces. They must remain light even when:

- the OS is in dark mode
- the app theme is set to dark
- `html.dark` is present
- the page is embedded or previewed inside a dark-themed environment

The boundary is `LightOnlyMarketingShell`, backed by `src/lib/design/marketing-theme.ts` and the `.light-only-marketing` CSS scope in `src/app/globals.css`. Do not add app theme toggles or dark/system theme choices to marketing pages.

## Adding Components

For authenticated app UI, start from the shared primitives in `src/components/ui`. If a new component needs a new color, prefer adding a CSS variable and Tailwind token instead of a component-local hex value.

For splash/marketing UI, keep styling inside the light-only marketing boundary. If new marketing colors are needed, add them to `src/lib/design/marketing-theme.ts`.

## Accessibility

Muted text must remain readable in both app themes. Metric chips, badges, QR payloads, timestamps, form borders, hover states, focus rings, and destructive states need contrast checks in light and dark modes.

## Required UI Testing Rule

Whenever making CSS, layout, or UI component changes, test affected authenticated app screens in both light and dark modes before considering the task complete.

Whenever making splash/marketing page changes, test the splash page while the app/system theme is dark and confirm it still renders in light mode only.
