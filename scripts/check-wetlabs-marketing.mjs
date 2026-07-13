import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

const [home, splash, projectCard, projects, links, typography, globalCss, caddy, caddyDockerfile, compose, appLayout, fluxpointSplash, fluxpointHero] = await Promise.all([
  read("src/app/page.tsx"),
  read("src/components/marketing/wetlabs/WetlabsSplashPage.tsx"),
  read("src/components/marketing/wetlabs/WetlabsProjectCard.tsx"),
  read("src/lib/wetlabs-projects.ts"),
  read("src/lib/wetlabs-links.ts"),
  read("src/lib/design/typography.ts"),
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
assert.match(splash, /wetlabs-wave-transition/, "the hero wave fades into the project shelf without a hard seam");
assert.match(splash, /wetlabsTypographyClassName/, "Wetlabs applies its scoped typography variables");
assert.match(typography, /Space_Grotesk[\s\S]*weight: \["500"\]/, "Wetlabs headings use Space Grotesk 500");
assert.match(typography, /Source_Sans_3[\s\S]*weight: \["400"\]/, "Wetlabs body copy uses Source Sans 3 400");
assert.match(globalCss, /\.wetlabs-page \{[\s\S]*--font-wetlabs-body/, "Wetlabs body font remains scoped to its page");
assert.match(globalCss, /\.wetlabs-display \{[\s\S]*--font-wetlabs-display/, "Wetlabs display font has a scoped utility");
assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wetlabs-page/, "Wetlabs disables motion when reduced motion is requested");
assert.match(links, /fluxpoint: "\/fluxpoint"/, "Fluxpoint is registered as an internal Wetlabs destination");
assert.match(links, /axildb: "https:\/\/www\.axildb\.com"/, "AxilDB is registered as an external destination");
assert.match(links, /youtube: "https:\/\/www\.youtube\.com\/@wetlabs"/, "YouTube uses the canonical Wetlabs channel");
assert.match(links, /github: "https:\/\/github\.com\/wetlabs-dev"/, "GitHub uses the Wetlabs organization");
assert.match(links, /kofi: "https:\/\/ko-fi\.com\/wetlabs"/, "Ko-fi uses the Wetlabs support page");
assert.match(projects, /wetlabsLinks\.fluxpoint/, "Fluxpoint project consumes the shared link registry");
assert.match(projects, /wetlabsLinks\.axildb/, "AxilDB project consumes the shared link registry");
assert.match(projectCard, /target="_blank" rel="noopener noreferrer"/, "external project cards open safely");
assert.match(splash, /Visit Wetlabs on YouTube/, "the static YouTube section has its canonical action");
assert.doesNotMatch(splash, /<iframe|youtube\.com\/embed/, "the YouTube section loads no embed or third-party script");

const footerMarkup = splash.slice(splash.indexOf("<footer"));
assert.doesNotMatch(footerMarkup, /wetlabsLinks\.(fluxpoint|axildb)/, "the footer omits the duplicate Fluxpoint and AxilDB project links");

const sectionOrder = ["id=\"projects\"", "What Wetlabs is", "id=\"philosophy\"", "id=\"youtube\"", "Working approach", "Support development", "<footer"];
let previousSectionIndex = -1;
for (const marker of sectionOrder) {
  const sectionIndex = splash.indexOf(marker);
  assert.ok(sectionIndex > previousSectionIndex, `${marker} appears in the required editorial order`);
  previousSectionIndex = sectionIndex;
}
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

console.log("Wetlabs routing, scoped typography, public links, editorial flow, metadata, light-only scope, Caddy behavior, protected app boundary, and optimized assets passed.");
