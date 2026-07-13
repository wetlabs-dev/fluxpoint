import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

const [home, splash, projects, globalCss, caddy, caddyDockerfile, compose, appLayout, fluxpointSplash, fluxpointHero] = await Promise.all([
  read("src/app/page.tsx"),
  read("src/components/marketing/wetlabs/WetlabsSplashPage.tsx"),
  read("src/lib/wetlabs-projects.ts"),
  read("src/app/globals.css"),
  read("deploy/caddy/Caddyfile"),
  read("deploy/caddy/Dockerfile"),
  read("docker-compose.yml"),
  read("src/app/(app)/layout.tsx"),
  read("src/components/marketing/FluxpointSplashPage.tsx"),
  read("src/components/marketing/FluxpointHero.tsx")
]);

assert.match(home, /return <WetlabsSplashPage \/>/, "root renders the public Wetlabs page");
assert.doesNotMatch(home, /redirect\(["']\/dashboard/, "root no longer redirects into the authenticated app");
assert.match(home, /https:\/\/www\.wetlabs\.dev/, "root metadata uses the canonical Wetlabs domain");
assert.match(home, /manifest: null/, "root metadata does not inherit the Fluxpoint PWA manifest");
assert.match(splash, /LightOnlyMarketingShell/, "Wetlabs stays inside the light-only marketing boundary");
assert.match(splash, /href="#projects"/, "project navigation is available without client state");
assert.match(splash, /wetlabs-wordmark\.png/, "supplied Wetlabs wordmark is used directly");
assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wetlabs-page/, "Wetlabs disables motion when reduced motion is requested");
assert.match(projects, /href: "\/fluxpoint"/, "Fluxpoint is an internal Wetlabs project");
assert.match(projects, /href: "https:\/\/www\.axildb\.com"/, "AxilDB remains an external project");
assert.match(appLayout, /requireUser\(\)/, "authenticated app routes remain protected");
assert.match(fluxpointSplash, /absoluteAppUrl\("\/dashboard"\)/, "Fluxpoint splash launches the protected dashboard explicitly");
assert.match(fluxpointHero, /absoluteAppUrl\("\/dashboard"\)/, "Fluxpoint hero launches the protected dashboard explicitly");
assert.match(caddy, /wetlabs\.dev \{\s+redir https:\/\/www\.wetlabs\.dev\{uri\} permanent/s, "bare Wetlabs domain redirects to www");
assert.match(caddy, /www\.wetlabs\.dev \{\s+encode zstd gzip\s+reverse_proxy app:3000/s, "www serves the full Next.js public surface");
assert.doesNotMatch(caddy, /axildb/i, "Caddy does not proxy AxilDB");
assert.match(caddyDockerfile, /FROM caddy:2\.8-alpine\s+COPY Caddyfile \/etc\/caddy\/Caddyfile/s, "Caddy image contains the versioned routing config");
assert.match(compose, /caddy:\s+image: fluxpoint-caddy\s+build:\s+context: \.\/deploy\/caddy/s, "normal Compose builds the Caddy routing image");
assert.doesNotMatch(compose, /Caddyfile:\/etc\/caddy\/Caddyfile/, "Caddy config is not a stale bind mount");

const mark = await sharp(path.join(root, "public/wetlabs/brand/wetlabs-mark.png")).metadata();
assert.deepEqual([mark.width, mark.height, mark.hasAlpha], [256, 256, true], "Wetlabs mark dimensions and transparency");
const wordmark = await sharp(path.join(root, "public/wetlabs/brand/wetlabs-wordmark.png")).metadata();
assert.deepEqual([wordmark.width, wordmark.height, wordmark.hasAlpha], [1408, 282, true], "Wetlabs wordmark dimensions and transparency");
const paper = await sharp(path.join(root, "public/wetlabs/brand/paper-texture.webp")).metadata();
assert.deepEqual([paper.width, paper.height, paper.format], [1800, 2549, "webp"], "optimized paper texture");
const og = await sharp(path.join(root, "public/wetlabs/brand/wetlabs-og.jpg")).metadata();
assert.deepEqual([og.width, og.height], [1200, 630], "Wetlabs social preview dimensions");
for (const file of ["wetlabs-mark.png", "wetlabs-wordmark.png", "paper-texture.webp", "wetlabs-og.jpg"]) {
  assert.ok((await stat(path.join(root, "public/wetlabs/brand", file))).size > 5_000, `${file} is present`);
}

console.log("Wetlabs routing, registry, metadata, light-only scope, Caddy behavior, protected app boundary, and optimized assets passed.");
