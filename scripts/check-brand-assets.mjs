import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const expected = new Map([
  ["app-icon-192.png", 192],
  ["app-icon-512.png", 512],
  ["app-icon-maskable-512.png", 512],
  ["app-icon-1024.png", 1024],
  ["apple-touch-icon.png", 180],
  ["favicon-16.png", 16],
  ["favicon-32.png", 32],
  ["favicon-48.png", 48],
  ["brand/fluxpoint-logo-256.png", 256],
  ["brand/fluxpoint-logo-512.png", 512]
]);

for (const [file, size] of expected) {
  const metadata = await sharp(path.join(root, "public", file)).metadata();
  assert.equal(metadata.width, size, `${file} width`);
  assert.equal(metadata.height, size, `${file} height`);
}

const logo = await sharp(path.join(root, "public", "brand", "fluxpoint-logo.png")).metadata();
assert.deepEqual([logo.width, logo.height, logo.hasAlpha], [1162, 1053, true]);

const manifest = JSON.parse(await readFile(path.join(root, "public", "manifest.webmanifest"), "utf8"));
assert.ok(manifest.icons.some((icon) => icon.src === "/app-icon-maskable-512.png" && icon.purpose === "maskable"));
for (const icon of manifest.icons) assert.ok((await stat(path.join(root, "public", icon.src))).size > 500, `${icon.src} exists`);

const favicon = await readFile(path.join(root, "public", "favicon.ico"));
assert.equal(favicon.readUInt16LE(0), 0);
assert.equal(favicon.readUInt16LE(2), 1);
assert.equal(favicon.readUInt16LE(4), 3);

for (const file of ["eddy-icon.png", "eddy-left.png", "eddy-right.png"]) assert.ok((await stat(path.join(root, "public", "brand", file))).size > 1_000);

console.log("Fluxpoint brand assets, manifest references, favicon frames, and Eddy asset presence passed.");
