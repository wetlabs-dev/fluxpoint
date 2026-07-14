# Public Marketing Surfaces

Fluxpoint’s deployment serves two related public identities without merging their application infrastructure.

## Public routes

- `/` is the Wetlabs umbrella homepage on `https://www.wetlabs.dev`.
- `/fluxpoint` is the Fluxpoint product splash page.
- `/fluxpoint/features` is the public Fluxpoint feature map.
- `/marketing-preview` is a local/portable alias for the Fluxpoint splash page.
- `https://www.axildb.com` is an external project destination. Fluxpoint does not proxy, embed, authenticate, or mirror AxilDB.

Authenticated application routes remain in the `(app)` route group. They continue to call `requireUser()` through `src/app/(app)/layout.tsx`; changing the public root does not change that boundary. Marketing controls that open the app link directly to the canonical Fluxpoint `/dashboard` URL.

## Wetlabs project registry

`src/lib/wetlabs-projects.ts` is the static public registry. Add a project there rather than adding project data directly to the homepage component. Each entry provides its destination, category, concise description, status, visual accent, and optional logo. External projects must set `external: true` and use their canonical HTTPS URL.

This registry is separate from `src/lib/public-features.ts`, which remains the Fluxpoint product feature catalog. It does not query private data or any database.

`src/lib/wetlabs-links.ts` is the single source of truth for public Wetlabs destinations: Fluxpoint, AxilDB, YouTube, GitHub, and Ko-fi. Navigation, project cards, community sections, support actions, and the footer consume that registry rather than repeating URLs.

## Wetlabs page structure and typography

The umbrella page follows a deliberately varied editorial rhythm: hero, project shelf, What Wetlabs Is, philosophy, YouTube, Working Approach, support, and footer. The YouTube area is static and makes no embed or third-party script request. Its channel link is `https://www.youtube.com/@wetlabs`; support links use `https://ko-fi.com/wetlabs` and the Wetlabs GitHub organization at `https://github.com/wetlabs-dev`.

Wetlabs uses a route-scoped type system: Playfair Display 700 for headings, Inter 700 for eyebrows and action labels, and Source Sans 3 400 for body copy and supporting UI. The font variables are attached only to `WetlabsSplashPage`; Fluxpoint keeps its existing Cabin, Inter, and IBM Plex Mono system.

The hero waterline is built from solid SVG paths with widthwise undulation, geometric-precision rendering, and same-color strokes that soften the visible path edges. The layers use different transform-only durations, directions, and delays, with smaller mobile amplitudes and a reduced-motion override that stops the decorative animation. The top navigation keeps compact AxilDB and Fluxpoint project buttons while secondary shortcuts collapse at narrower widths.

## Brand assets

Wetlabs web assets live in `public/wetlabs/brand`:

- `wetlabs-embossed.png` and `wetlabs-stacked-embossed.png` are the supplied transparent embossed lockups used in the header/footer and hero respectively.
- `wethands-embossed.png` is the supplied script tagline used directly in the hero.
- `wetlabs-mark.png` and `wetlabs-wordmark.png` are retained flat assets used for route metadata and compatibility.
- `paper-texture.webp` is an optimized 1800px-wide derivative of the supplied paper texture and is used as a quiet page background.
- `wetlabs-og.jpg` is a 1200×630 center crop derived from the supplied YouTube banner and is used for Open Graph and X/Twitter previews.

The supplied Fluxpoint and AxilDB app icons live under `public/wetlabs/projects` and appear inside matching CSS squircle masks on the project shelf. The project artwork background uses broad color fields without the former thin orbit line. No source font files are shipped.

The root page overrides the inherited Fluxpoint manifest and icons at route level so Wetlabs metadata does not replace the installed Fluxpoint PWA identity globally. Its canonical URL is `https://www.wetlabs.dev`.

## Theme and accessibility

Wetlabs uses `LightOnlyMarketingShell`, the same isolation boundary as the Fluxpoint marketing surfaces. It remains light when `html.dark` is present while authenticated Fluxpoint routes continue to honor light, dark, and system preferences.

The page uses semantic landmarks and headings, visible focus rings, compact primary navigation, text descriptions in addition to link icons, safe external-link behavior, and no hover-only information. Project card movement, wave undulation, and all other decorative motion are effectively disabled under `prefers-reduced-motion: reduce`.

## Domain routing

`deploy/caddy/Caddyfile` routes both `www.wetlabs.dev` and `fluxpoint.wetlabs.dev` to the existing Next.js app. The full `www` host is proxied so `/`, `/fluxpoint`, Next.js assets, metadata images, and other established public routes resolve through the same deployment. `wetlabs.dev` redirects permanently to `https://www.wetlabs.dev` while preserving the path. No AxilDB host or path is proxied.
