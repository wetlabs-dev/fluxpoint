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
assert.match(splash, /wetlabs-embossed\.png/, "the supplied embossed horizontal Wetlabs lockup is used directly");
assert.match(splash, /wetlabs-stacked-embossed\.png/, "the supplied embossed stacked Wetlabs lockup is used in the hero");
assert.match(splash, /wethands-embossed\.png/, "the supplied script tagline replaces styled text");
assert.match(splash, /<svg className="wetlabs-wave-svg"[\s\S]*<path d="M-180 38 C24 24[\s\S]*<path d="M-180 214 C45 202/, "the wave uses smooth oversized SVG paths with multiple widthwise undulations");
assert.match(splash, /wetlabs-wave-green[\s\S]*wetlabs-wave-teal[\s\S]*wetlabs-wave-blue[\s\S]*wetlabs-wave-pale[\s\S]*wetlabs-wave-mist/, "the hero waterline transitions from saturated green and blue into lighter paths");
assert.doesNotMatch(splash, /WetlabsWaveBands|wetlabs-wave-transition|wetlabs-wave-back|wetlabs-wave-front/, "superseded wave treatments remain removed");
assert.match(splash, /wetlabsLinks\.axildb[\s\S]*AxilDB[\s\S]*wetlabsLinks\.fluxpoint[\s\S]*Fluxpoint/, "header exposes AxilDB and Fluxpoint project buttons");
assert.match(splash, /wetlabsTypographyClassName/, "Wetlabs applies its scoped typography variables");
assert.match(typography, /Playfair_Display[\s\S]*weight: \["700"\]/, "Wetlabs headings use Playfair Display 700");
assert.doesNotMatch(typography, /Space_Grotesk/, "Space Grotesk is no longer loaded");
assert.match(typography, /wetlabsTypographyClassName = `\$\{wetlabsDisplayFont\.variable\} \$\{wetlabsBodyFont\.variable\} \$\{sansFont\.variable\}`/, "Wetlabs exposes Inter for UI labels");
assert.match(typography, /Source_Sans_3[\s\S]*weight: \["400"\]/, "Wetlabs body copy uses Source Sans 3 400");
assert.match(globalCss, /\.wetlabs-page \{[\s\S]*--font-wetlabs-body/, "Wetlabs body font remains scoped to its page");
assert.match(globalCss, /\.wetlabs-display \{[\s\S]*--font-wetlabs-display/, "Wetlabs display font has a scoped utility");
assert.match(globalCss, /\.wetlabs-ui \{[\s\S]*--font-sans[\s\S]*font-weight: 700/, "Wetlabs action labels use Inter with a readable weight");
assert.match(globalCss, /\.wetlabs-eyebrow \{[\s\S]*--font-sans[\s\S]*font-size: 0\.84rem[\s\S]*letter-spacing: 0\.12em/, "Wetlabs eyebrows use Inter sizing and spacing");
assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wetlabs-page/, "Wetlabs disables motion when reduced motion is requested");
assert.match(globalCss, /\.wetlabs-wave-svg \{[\s\S]*shape-rendering: geometricPrecision/, "wave paths request geometric precision for smoother curves");
assert.match(globalCss, /\.wetlabs-wave-layer path \{[\s\S]*stroke-width: 1\.4/, "wave paths use a same-color stroke to soften antialiasing at band edges");
assert.match(globalCss, /\.wetlabs-wave-layer \{[\s\S]*will-change: transform/, "wave motion uses compositor-friendly transform animation");
assert.match(globalCss, /animation: wetlabs-wave-drift-green 22s[\s\S]*animation: wetlabs-wave-drift-teal 27s[\s\S]*animation: wetlabs-wave-drift-blue 33s[\s\S]*animation: wetlabs-wave-drift-pale 39s[\s\S]*animation: wetlabs-wave-drift-mist 43s/, "wave layers use independent slow animation phases");
assert.match(globalCss, /@media \(max-width: 639px\)[\s\S]*wetlabs-wave-drift-green-mobile[\s\S]*wetlabs-wave-drift-mist-mobile/, "mobile wave motion uses smaller-amplitude keyframes");
assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wetlabs-wave-layer \{[\s\S]*animation: none !important/, "reduced motion stops decorative wave animation");
assert.doesNotMatch(globalCss, /wetlabs-wave-green \{[^}]*linear-gradient|wetlabs-wave-teal \{[^}]*linear-gradient|wetlabs-wave-layer \{[^}]*position: absolute/, "wave color bands remain clean solid fills and path-based layers");
assert.doesNotMatch(splash + projectCard + globalCss, /tracking-\[-/, "Wetlabs typography does not use negative tracking utilities");
assert.match(splash, /wetlabs-ui[\s\S]*Browse the projects[\s\S]*wetlabs-ui[\s\S]*Visit Wetlabs on YouTube[\s\S]*wetlabs-ui[\s\S]*Support on Ko-fi/, "primary buttons use the Wetlabs UI font");
assert.match(projectCard, /wetlabs-ui[\s\S]*Explore \{project\.name\}/, "project card action labels use the Wetlabs UI font");
assert.match(links, /fluxpoint: "\/fluxpoint"/, "Fluxpoint is registered as an internal Wetlabs destination");
assert.match(links, /axildb: "https:\/\/www\.axildb\.com"/, "AxilDB is registered as an external destination");
assert.match(links, /youtube: "https:\/\/www\.youtube\.com\/@wetlabs"/, "YouTube uses the canonical Wetlabs channel");
assert.match(links, /github: "https:\/\/github\.com\/wetlabs-dev"/, "GitHub uses the Wetlabs organization");
assert.match(links, /kofi: "https:\/\/ko-fi\.com\/wetlabs"/, "Ko-fi uses the Wetlabs support page");
assert.match(projects, /wetlabsLinks\.fluxpoint/, "Fluxpoint project consumes the shared link registry");
assert.match(projects, /wetlabsLinks\.axildb/, "AxilDB project consumes the shared link registry");
assert.match(projects, /fluxpoint-app-icon\.png[\s\S]*axildb-app-icon\.png/, "both project cards use their supplied app icons");
assert.match(projectCard, /<a href=\{project\.href\} className=\{className\}/, "AxilDB uses a full-card semantic anchor");
assert.match(projectCard, /<Link href=\{project\.href\} className=\{className\}/, "Fluxpoint uses a full-card semantic link");
assert.doesNotMatch(projectCard, /target="_blank"|ArrowUpRight/, "project cards use consistent same-tab navigation without external-link icons");
assert.doesNotMatch(projectCard, /External site|wetlabs-project-orbit/, "project cards omit the external label and thin orbit decoration");
assert.match(projectCard, /rounded-\[23%\]/, "project icons use a squircle mask");
assert.match(splash, /Development videos coming soon/, "the YouTube area is framed as a future development log");
assert.doesNotMatch(splash, /<iframe|youtube\.com\/embed/, "the YouTube section loads no embed or third-party script");

const footerMarkup = splash.slice(splash.indexOf("<footer"));
assert.doesNotMatch(footerMarkup, /wetlabsLinks\.(fluxpoint|axildb)|absoluteAppUrl|Open Fluxpoint/, "the footer contains no Fluxpoint or AxilDB destination");
for (const publicLink of ["youtube", "github", "kofi"]) {
  assert.match(footerMarkup, new RegExp(`wetlabsLinks\\.${publicLink}`), `the footer uses the ${publicLink} registry value`);
}

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
const embossed = await sharp(path.join(root, "public/wetlabs/brand/wetlabs-embossed.png")).metadata();
assert.deepEqual([embossed.width, embossed.height, embossed.hasAlpha], [4639, 1239, true], "embossed horizontal Wetlabs lockup dimensions and transparency");
const stacked = await sharp(path.join(root, "public/wetlabs/brand/wetlabs-stacked-embossed.png")).metadata();
assert.deepEqual([stacked.width, stacked.height, stacked.hasAlpha], [3278, 2103, true], "embossed stacked Wetlabs lockup dimensions and transparency");
const tagline = await sharp(path.join(root, "public/wetlabs/brand/wethands-embossed.png")).metadata();
assert.deepEqual([tagline.width, tagline.height, tagline.hasAlpha], [1720, 240, true], "embossed tagline dimensions and transparency");
for (const [file, width, height] of [["fluxpoint-app-icon.png", 1024, 1024], ["axildb-app-icon.png", 1024, 1024]]) {
  const icon = await sharp(path.join(root, "public/wetlabs/projects", file)).metadata();
  assert.deepEqual([icon.width, icon.height], [width, height], `${file} dimensions`);
}
const paper = await sharp(path.join(root, "public/wetlabs/brand/paper-texture.webp")).metadata();
assert.deepEqual([paper.width, paper.height, paper.format], [1800, 2549, "webp"], "optimized paper texture");
const og = await sharp(path.join(root, "public/wetlabs/brand/wetlabs-og.jpg")).metadata();
assert.deepEqual([og.width, og.height], [1200, 630], "Wetlabs social preview dimensions");
for (const file of ["wetlabs-mark.png", "wetlabs-wordmark.png", "wetlabs-embossed.png", "wetlabs-stacked-embossed.png", "wethands-embossed.png", "paper-texture.webp", "wetlabs-og.jpg"]) {
  assert.ok((await stat(path.join(root, "public/wetlabs/brand", file))).size > 5_000, `${file} is present`);
}

console.log("Wetlabs routing, scoped typography, public links, editorial flow, metadata, light-only scope, Caddy behavior, protected app boundary, and optimized assets passed.");
