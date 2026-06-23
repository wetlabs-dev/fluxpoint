import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const appIconSource = path.join(root, "public", "app-icon-1024.png");
const logoSource = path.join(root, "public", "brand", "fluxpoint-logo.png");

async function assertSource(file, width, height, alpha) {
  const metadata = await sharp(file).metadata();
  if (metadata.width !== width || metadata.height !== height) throw new Error(`${path.relative(root, file)} must be ${width}x${height}; received ${metadata.width}x${metadata.height}.`);
  if (alpha && !metadata.hasAlpha) throw new Error(`${path.relative(root, file)} must preserve transparency.`);
}

async function squareIcon(size, filename) {
  await sharp(appIconSource).resize(size, size, { fit: "cover", kernel: sharp.kernel.lanczos3 }).png({ compressionLevel: 9 }).toFile(path.join(root, "public", filename));
}

async function maskableIcon(size, filename) {
  const safeSize = Math.round(size * 0.8);
  const inset = Math.floor((size - safeSize) / 2);
  const artwork = await sharp(appIconSource).resize(safeSize, safeSize, { fit: "cover", kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } })
    .composite([{ input: artwork, left: inset, top: inset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public", filename));
}

async function squareLogo(size, filename) {
  await sharp(logoSource)
    .resize(size, size, { fit: "contain", kernel: sharp.kernel.lanczos3, background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public", "brand", filename));
}

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, bytes }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.bytes)]);
}

await assertSource(appIconSource, 1024, 1024, false);
await assertSource(logoSource, 1162, 1053, true);

await Promise.all([
  squareIcon(192, "app-icon-192.png"),
  squareIcon(512, "app-icon-512.png"),
  maskableIcon(512, "app-icon-maskable-512.png"),
  squareIcon(180, "apple-touch-icon.png"),
  squareIcon(16, "favicon-16.png"),
  squareIcon(32, "favicon-32.png"),
  squareIcon(48, "favicon-48.png"),
  squareLogo(256, "fluxpoint-logo-256.png"),
  squareLogo(512, "fluxpoint-logo-512.png")
]);

const faviconImages = await Promise.all([16, 32, 48].map(async (size) => ({ size, bytes: await readFile(path.join(root, "public", `favicon-${size}.png`)) })));
await writeFile(path.join(root, "public", "favicon.ico"), ico(faviconImages));

for (const file of ["app-icon-192.png", "app-icon-512.png", "app-icon-maskable-512.png", "apple-touch-icon.png", "favicon-16.png", "favicon-32.png", "favicon-48.png", "favicon.ico", "brand/fluxpoint-logo-256.png", "brand/fluxpoint-logo-512.png"]) {
  const info = await stat(path.join(root, "public", file));
  if (info.size < 500) throw new Error(`${file} was not generated correctly.`);
}

console.log("Generated Fluxpoint app, favicon, Apple touch, maskable, and UI logo assets from the canonical public sources.");
