# Fluxpoint Branding Assets

Fluxpoint keeps application branding separate from Eddy assistant artwork.

- `public/app-icon-1024.png` is the canonical square app-icon source.
- `public/brand/fluxpoint-logo.png` is the canonical transparent standalone Fluxpoint mark.
- `public/brand/eddy-*` contains Eddy-only artwork and must not be changed by Fluxpoint brand generation.

Run `npm run generate:brand-icons` after replacing either canonical Fluxpoint source. The Sharp-based generator produces:

- PWA icons at 192, 512, and the preserved canonical 1024 pixels;
- a dedicated 512-pixel maskable icon with the source artwork inset into the adaptive-icon safe zone;
- the 180-pixel Apple touch icon;
- 16, 32, and 48-pixel favicon PNGs plus a multi-image `favicon.ico`;
- transparent, square-padded 256 and 512-pixel UI logo derivatives.

The app shell, authentication pages, maintenance screen, and marketing header use the transparent Fluxpoint logo derivatives on a light neutral tile so the aqua/green mark and dark outline remain legible in light, dark, and textured contexts. PWA and favicon derivatives use the supplied square artwork directly.

Browsers and installed PWAs cache icons aggressively. After deployment, a hard refresh normally updates the favicon. Existing Home Screen or installed PWA entries may need to be removed and installed again before the operating system displays the new icon.
