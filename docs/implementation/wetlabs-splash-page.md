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

## Assets used

Assets are stored under `public/wetlabs/brand`.

- `wetlabs-mark.png`: the supplied transparent 256×256 mark, used in the header, hero, footer, and route-level icon metadata.
- `wetlabs-wordmark.png`: the supplied transparent 1408×282 wordmark, used directly in all Wetlabs header, hero, and footer lockups. It is served without Next.js image re-encoding so its transparent color treatment remains reliable.
- `paper-texture.webp`: an optimized 1800×2549 WebP derivative of the supplied paper texture, used as the responsive page ground.
- `wetlabs-og.jpg`: a 1200×630 center crop derived from the supplied YouTube banner, used for Open Graph and X/Twitter previews.

The paper-backed standalone logo, the larger paper-backed wordmark lockup, and the Ko-fi banner were used as visual references but not loaded into the responsive page because their embedded whitespace and fixed compositions would require poor crops. The YouTube banner is not loaded into the page; only its purpose-made social-preview derivative is shipped. The independent AxilDB card uses clean text rather than an invented logo because no AxilDB artwork was supplied.

## Content structure

The page contains:

1. a hero with the supplied mark and wordmark, purpose statement, and project/philosophy actions;
2. registry-driven Fluxpoint and AxilDB project cards;
3. a plainspoken explanation of Wetlabs as an independent project umbrella;
4. four design principles covering observation, legible complexity, history, and long-term usefulness;
5. a working-approach section focused on iterative real-world use, data ownership, transparent uncertainty, and assistive rather than authoritative behavior;
6. an understated project footer.

## Project registry

`src/lib/wetlabs-projects.ts` defines each project’s name, destination, category, description, status, optional logo, external behavior, and accent. Adding a future project requires one registry entry; the page and card grid do not hardcode the initial project count.

## Responsive behavior

- The hero changes from a two-column composition to a readable single column.
- Project cards stack below the desktop breakpoint and retain full-card touch targets.
- Navigation remains compact; the Philosophy shortcut hides at phone width while Projects and Fluxpoint remain accessible.
- Responsive browser checks passed at 375, 768, 1280, and 1600 CSS pixels with no horizontal overflow.
- Typography is capped on small screens and project artwork has intentional fixed-height crops.

## Accessibility decisions

- Semantic `main`, `header`, `nav`, `section`, `article`, `footer`, and ordered heading levels are used.
- Project cards are native links; external destinations include explicit accessible text and an external-link treatment.
- Primary controls use at least 44px touch targets and visible `focus-visible` rings.
- Decorative imagery uses empty alternative text; the brand lockup exposes “Wetlabs” once per context.
- Information is never hover-only.
- The restrained hover movement and all other transitions are effectively disabled under `prefers-reduced-motion: reduce`.
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
- Browser QA — 375, 768, 1280, and 1600 widths passed without overflow; supplied wordmark verified on mobile and desktop; `html.dark` was present while both Wetlabs and Fluxpoint marketing shells computed `color-scheme: light`
- `git diff --check` — passed

The configured `npm run lint` script invokes the deprecated interactive `next lint` setup and does not currently provide a non-interactive lint run. No lint configuration was added as part of this marketing change; the production build’s type and validity checks passed.

## Remaining deployment steps

After the final commit reaches the production checkout, pull it and rebuild the normal Compose stack. Confirm DNS for the bare and `www` Wetlabs hostnames, then smoke-test `https://www.wetlabs.dev`, `/fluxpoint`, the external AxilDB link, and `https://fluxpoint.wetlabs.dev/dashboard`.
