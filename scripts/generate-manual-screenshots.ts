import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { manualScreenshotTargets } from "../src/lib/user-manual";

type PlaywrightModule = {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<{
      newPage: (options?: { viewport?: { width: number; height: number } }) => Promise<ManualPage>;
      close: () => Promise<void>;
    }>;
  };
};

type ManualPage = {
  goto: (url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number }) => Promise<unknown>;
  locator: (selector: string) => ManualLocator;
  getByRole: (role: string, options?: { name?: RegExp | string }) => ManualLocator;
  waitForLoadState: (state?: "load" | "domcontentloaded" | "networkidle", options?: { timeout?: number }) => Promise<void>;
  screenshot: (options: { path: string; fullPage?: boolean }) => Promise<Buffer>;
};

type ManualLocator = {
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  click: () => Promise<void>;
  first: () => ManualLocator;
};

const repoRoot = process.cwd();
const outputDir = join(repoRoot, "public", "manual", "screenshots");

function envFlag(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<PlaywrightModule>;
    return await dynamicImport("playwright");
  } catch (error) {
    throw new Error(
      "Manual screenshot generation requires Playwright. Install it with `npm install -D playwright` and `npx playwright install chromium`, then rerun `npm run docs:screenshots`.",
      { cause: error }
    );
  }
}

function base32Decode(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("FLUXPOINT_DOCS_TOTP_SECRET is not valid base32.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpCode(secret: string, now = Date.now()) {
  const counter = Math.floor(now / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function docsTotpCode() {
  return process.env.FLUXPOINT_DOCS_TOTP_CODE || (process.env.FLUXPOINT_DOCS_TOTP_SECRET ? totpCode(process.env.FLUXPOINT_DOCS_TOTP_SECRET) : "");
}

async function maybeFill(page: ManualPage, selector: string, value: string) {
  const locator = page.locator(selector);
  if ((await locator.count()) > 0) await locator.first().fill(value);
}

async function loginIfNeeded(page: ManualPage, baseUrl: string) {
  if (envFlag("FLUXPOINT_DOCS_SKIP_LOGIN")) return;

  const email = process.env.FLUXPOINT_DOCS_EMAIL || process.env.ADMIN_EMAIL;
  const password = process.env.FLUXPOINT_DOCS_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set FLUXPOINT_DOCS_EMAIL and FLUXPOINT_DOCS_PASSWORD, provide ADMIN_EMAIL and ADMIN_PASSWORD, or set FLUXPOINT_DOCS_SKIP_LOGIN=true for an already-public/manual-friendly target.");
  }

  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle", timeout: 30_000 });
  await maybeFill(page, 'input[name="email"]', email);
  await maybeFill(page, 'input[name="password"]', password);

  const submit = page.getByRole("button", { name: /log in|sign in/i });
  if ((await submit.count()) > 0) {
    await submit.first().click();
  } else {
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
  }
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  await completeTwoFactorIfNeeded(page);
}

async function completeTwoFactorIfNeeded(page: ManualPage) {
  const codeInput = page.locator('input[name="code"], input[autocomplete="one-time-code"]');
  if ((await codeInput.count()) === 0) return;

  const totp = docsTotpCode();
  if (!totp) {
    throw new Error("Screenshot capture reached two-factor verification. Set FLUXPOINT_DOCS_TOTP_SECRET for the docs account or FLUXPOINT_DOCS_TOTP_CODE for a one-time run.");
  }

  console.log("Completing two-factor verification for documentation capture.");
  await codeInput.first().fill(totp);
  const verify = page.getByRole("button", { name: /verify/i });
  if ((await verify.count()) > 0) {
    await verify.first().click();
  } else {
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
  }
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
}

async function main() {
  const baseUrl = process.env.FLUXPOINT_DOCS_BASE_URL || "http://localhost:3000";
  mkdirSync(outputDir, { recursive: true });

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await loginIfNeeded(page, baseUrl);

    for (const section of manualScreenshotTargets) {
      if (!section.route || !section.screenshot) continue;
      const url = new URL(section.route, baseUrl).toString();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      } catch (error) {
        throw new Error(`Unable to load ${url}. Start Fluxpoint or set FLUXPOINT_DOCS_BASE_URL to a reachable app URL.`, { cause: error });
      }
      await page.screenshot({ path: join(outputDir, section.screenshot), fullPage: true });
      console.log(`Wrote ${section.screenshot}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
