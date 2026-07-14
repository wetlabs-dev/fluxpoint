# Wetlabs Splash Page Implementation

## Summary

The Fluxpoint deployment now serves a public Wetlabs umbrella homepage at `/`. The previous root route redirected directly to `/dashboard`; the new route is static, requires no authentication or database data, presents Wetlabs’ philosophy and working approach, and links to the separate Fluxpoint and AxilDB project destinations.

Fluxpoint remains a distinct product at `/fluxpoint`, its feature map remains at `/fluxpoint/features`, and authenticated application routes remain inside the existing protected `(app)` route group.

## Route changes

- `/` renders `WetlabsSplashPage` and exposes Wetlabs-specific route metadata.
- `/fluxpoint` and `/marketing-preview` continue to render `FluxpointSplashPage`.
- `/fluxpoint/features` is unchanged as the public Fluxpoint feature map.
- Fluxpoint launch links now target the canonical app `/dashboard` explicitly because `/` no longer redirects there.
- The Fluxpoint splash header and footer include a restrained link back to the Wetlabs homepage.
- AxilDB is linked only as `https://www.axildb.com`; no proxy, embed, shared authentication, or mirrored content was added.

## Components created

- `src/components/marketing/wetlabs/WetlabsSplashPage.tsx` contains the semantic public page structure.
- `src/components/marketing/wetlabs/WetlabsProjectCard.tsx` renders reusable keyboard- and touch-friendly internal or external project cards.
- `src/lib/wetlabs-projects.ts` is the static project registry and is intentionally separate from Fluxpoint’s public feature registry.
- `src/lib/wetlabs-links.ts` centralizes the public Fluxpoint, AxilDB, YouTube, GitHub, and Ko-fi destinations.

## Assets used

Brand assets are stored under `public/wetlabs/brand`; project artwork is stored under `public/wetlabs/projects`.

- `wetlabs-embossed.png`: the supplied transparent horizontal embossed lockup, used in the header and footer.
- `wetlabs-stacked-embossed.png`: the supplied transparent stacked embossed lockup, used as the hero brand image.
- `wethands-embossed.png`: the supplied transparent script treatment for “wet hands, quiet mind,” used instead of recreating the lettering with a web font.
- `fluxpoint-app-icon.png` and `axildb-app-icon.png`: supplied 1024×1024 project artwork, clipped with a CSS squircle mask in their project cards.
- `wetlabs-mark.png` and `wetlabs-wordmark.png`: the earlier flat transparent assets retained for route-level icon metadata and compatibility.
- `paper-texture.webp`: an optimized 1800×2549 WebP derivative of the supplied paper texture, used as the responsive page ground.
- `wetlabs-og.jpg`: a 1200×630 center crop derived from the supplied YouTube banner, used for Open Graph and X/Twitter previews.

The embossed PNGs retain their authored depth, color, and transparent edges; the page does not approximate these treatments with CSS text or substitute fonts. The YouTube banner is not loaded into the page; only its purpose-made social-preview derivative is shipped.

## Content structure

The revised page contains:

1. a tighter hero with a compact headline, the supplied mark and wordmark, purpose statement, project/philosophy actions, and header buttons for AxilDB and Fluxpoint;
2. calmer registry-driven Fluxpoint and AxilDB project cards with matched visual height and no redundant status badges;
3. one plainspoken explanation of Wetlabs followed by three editorial traits;
4. four lightly divided philosophy notes covering observation, legible complexity, history, and long-term usefulness;
5. a static development-log preview linked to `https://www.youtube.com/@wetlabs`, with no embed or third-party JavaScript;
6. the dark-teal working-approach panel;
7. a compact support card linked to `https://ko-fi.com/wetlabs` and `https://github.com/wetlabs-dev`;
8. a quiet community footer with YouTube, GitHub, Ko-fi, and reduced-emphasis copyright text.

The hero transition follows the supplied mockup: the saturated green and teal-blue paths remain at the top, then a deep blue band steps through pale blue and mist-colored lower paths before meeting the project shelf. The wave is an oversized decorative SVG with solid filled paths, same-color hairline strokes for smoother antialiasing, and several gentle widthwise undulations in each band. Each layer has a very slow transform-only motion with independent duration, direction, and delay so the waterline feels gently alive without shifting layout.

## Typography

Wetlabs uses Playfair Display 700 for display headings, Inter 700 for eyebrows and action labels, and Source Sans 3 400 for body and supporting UI. These fonts are loaded through `next/font` and exposed through Wetlabs-only CSS variables. The variables are attached to the Wetlabs root `<main>`, so no Fluxpoint route inherits this pairing.

## Project registry

`src/lib/wetlabs-projects.ts` defines each project’s name, destination, category, description, status, optional logo, external behavior, and accent. Adding a future project requires one registry entry; the page and card grid do not hardcode the initial project count. Destinations come from `src/lib/wetlabs-links.ts`, which also supplies the navigation, YouTube, support, and footer URLs.

## Project navigation

Both project cards are full-card semantic links with one visible focus ring and no nested controls. Fluxpoint navigates to `/fluxpoint`; AxilDB navigates to `https://www.axildb.com` in the same tab so ordinary Back navigation returns to Wetlabs. Neither card adds an external-site label or forces a new browsing context. Both use their supplied app artwork in matching squircle masks, stretch to the same row height, and omit the former thin orbit decoration from the artwork background.

## YouTube and readability refinements

The YouTube panel is an editorial development-log preview rather than an imitation media player. Its decorative YouTube mark, development-log heading, explanatory copy, and topic labels describe future logs, design decisions, walkthroughs, and progress over time; the whole preview links to the centralized channel URL without loading an iframe or YouTube script.

The top navigation, section eyebrows, and footer links were increased modestly and given stronger contrast, while the footer copyright remains quieter than the main content. Eyebrows and buttons use Inter so they stay legible beside the more expressive Playfair headings. The hero and section heading scale is capped so the opening copy does not run into the wave transition. The YouTube section now has less bottom space before the working-approach panel, while the support card constrains its width and keeps the Ko-fi and GitHub actions closer to the copy. Playfair Display, Inter, and Source Sans 3 remain scoped to Wetlabs.

## Responsive behavior

- The hero changes from a two-column composition to a readable single column.
- Project cards stack below the desktop breakpoint and retain full-card touch targets.
- Navigation remains compact; secondary shortcuts hide progressively while AxilDB and Fluxpoint remain accessible.
- The layered waterline retains organic contours at narrow widths, with reduced mobile motion amplitudes.
- Support actions stack below the copy on phones and remain grouped beside it on desktop.
- Responsive browser checks cover 375, 430, 768, 1280, and 1600 CSS pixels with no horizontal overflow.
- Typography is capped on small screens and project artwork has intentional fixed-height crops.

## Accessibility decisions

- Semantic `main`, `header`, `nav`, `section`, `article`, `footer`, and ordered heading levels are used.
- Project cards are native full-card links; AxilDB retains a descriptive accessible label and same-tab behavior without additional visible destination text.
- The decorative waterline is hidden from assistive technology, and the YouTube mark is not exposed as a functional video control.
- Primary controls use at least 44px touch targets and visible `focus-visible` rings.
- Decorative imagery uses empty alternative text; the brand lockup exposes “Wetlabs” once per context.
- Information is never hover-only.
- The restrained hover movement and decorative wave animation are disabled under `prefers-reduced-motion: reduce`.
- The deep teal, muted teal, paper, and white combinations were chosen to maintain WCAG AA text contrast.

## Metadata

The root route has an absolute `Wetlabs` title, a concise description, canonical `https://www.wetlabs.dev`, Open Graph metadata, a 1200×630 social image, X/Twitter large-card metadata, and Wetlabs-specific route icons. It explicitly clears the inherited Fluxpoint PWA manifest and Apple web-app metadata so the installed Fluxpoint identity is not overwritten globally.

The rendered root HTML was verified to contain the Wetlabs canonical URL and social image and to omit the Fluxpoint manifest link.

## Caddy and domain verification

`deploy/caddy/Caddyfile` now:

- keeps `fluxpoint.wetlabs.dev` proxied to the existing Next.js app;
- proxies the complete `www.wetlabs.dev` host to that app so `/`, `/fluxpoint`, Next.js assets, and established public routes resolve together;
- redirects `wetlabs.dev` permanently to `https://www.wetlabs.dev{uri}`;
- contains no AxilDB handler.

`deploy/caddy/Dockerfile` copies that configuration into a minimal `fluxpoint-caddy` image. This avoids the production failure mode where a bind-mounted file changes on disk but the already-running Caddy process continues serving its old in-memory configuration. The normal `docker compose up -d --build` workflow now rebuilds and recreates Caddy when routing changes.

`docker compose config --quiet` and Caddy’s own configuration validator both passed. DNS must point `www.wetlabs.dev`, `wetlabs.dev`, and `fluxpoint.wetlabs.dev` at the deployment for Caddy to provision certificates and serve the routes.

## Files changed

- Root route and global marketing styles: `src/app/page.tsx`, `src/app/globals.css`
- Wetlabs UI and registry: `src/components/marketing/wetlabs/*`, `src/lib/wetlabs-projects.ts`
- Fluxpoint umbrella/launch integration: `src/components/marketing/FluxpointSplashPage.tsx`, `src/components/marketing/FluxpointHero.tsx`, `src/app/fluxpoint/features/page.tsx`
- Brand assets: `public/wetlabs/brand/*`
- Routing/deployment: `deploy/caddy/Caddyfile`
- Checks: `scripts/check-wetlabs-marketing.mjs`, `package.json`
- Documentation: `README.md`, `docs/product/public-marketing.md`, `docs/deployment/docker-compose-caddy-postgres.md`, this report

## Checks run

- `npm run check:wetlabs-marketing` — passed
- `npm run typecheck` — passed
- `npm run check:production` — passed, including Prisma generation and the production Next.js build
- `npm run docker:build:app` — passed; `fluxpoint-app:latest` built successfully
- `docker compose config --quiet` — passed
- Caddy `validate --config /etc/caddy/Caddyfile` — passed
- HTTP route checks — `/`, `/fluxpoint`, `/fluxpoint/features`, and `/request-account` returned 200; unauthenticated `/dashboard` returned 307 to `/login`
- Browser QA — 375, 430, 768, 1280, and 1600 widths passed without horizontal overflow; the three-line hero, supplied wordmark, project shelf, YouTube, working-approach, support, and footer compositions were visually inspected; `html.dark` was present while the Wetlabs marketing shell still computed `color-scheme: light`
- `git diff --check` — passed

The configured `npm run lint` script invokes the deprecated interactive `next lint` setup and does not currently provide a non-interactive lint run. No lint configuration was added as part of this marketing change; the production build’s type and validity checks passed.

## Remaining deployment steps

After the final commit reaches the production checkout, pull it and rebuild the normal Compose stack. Confirm DNS for the bare and `www` Wetlabs hostnames, then smoke-test `https://www.wetlabs.dev`, `/fluxpoint`, the external AxilDB link, and `https://fluxpoint.wetlabs.dev/dashboard`.
