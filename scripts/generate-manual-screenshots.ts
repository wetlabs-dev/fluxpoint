import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
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
  waitForTimeout: (timeout: number) => Promise<void>;
  waitForURL: (url: string | RegExp | ((url: URL) => boolean), options?: { timeout?: number }) => Promise<void>;
  screenshot: (options: { path: string; fullPage?: boolean }) => Promise<Buffer>;
  url: () => string;
};

type ManualLocator = {
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  click: () => Promise<void>;
  first: () => ManualLocator;
  innerText: () => Promise<string>;
  waitFor: (options?: { state?: "visible"; timeout?: number }) => Promise<void>;
};

const repoRoot = process.cwd();
const outputDir = join(repoRoot, "public", "manual", "screenshots");

loadDocsEnvFiles();

function loadDocsEnvFiles() {
  const productionEnv = readEnvFile(join(repoRoot, ".env.production"));
  const docsEnv = readEnvFile(join(repoRoot, ".env.docs-screenshots"));
  const merged = { ...productionEnv, ...nonEmptyEntries(docsEnv) };
  for (const [key, value] of Object.entries(merged)) {
    if (!key.startsWith("FLUXPOINT_DOCS_") && key !== "ADMIN_EMAIL" && key !== "ADMIN_PASSWORD") continue;
    if (process.env[key]?.trim()) continue;
    if (!value.trim()) continue;
    process.env[key] = value;
  }
}

function readEnvFile(path: string) {
  if (!existsSync(path)) return {} as Record<string, string>;
  const entries: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    entries[match[1]] = parseEnvValue(match[2]);
  }
  return entries;
}

function nonEmptyEntries(entries: Record<string, string>) {
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value.trim()));
}

function parseEnvValue(raw: string) {
  let value = raw.trim();
  if (!value) return "";
  const quote = value[0];
  if ((quote === `"` || quote === `'`) && value.endsWith(quote)) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }
  return value;
}

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

function cleanTotpSecret(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.includes("secret=")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.searchParams.get("secret")?.trim() || trimmed;
    } catch {
      const match = trimmed.match(/[?&]secret=([^&\s]+)/i);
      return match ? decodeURIComponent(match[1]).trim() : trimmed;
    }
  }
  return trimmed;
}

function base32Decode(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
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

function generateTotp(secret: string, counterOffset = 0) {
  const counter = Math.floor(Date.now() / 30_000) + counterOffset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function docsTotpCodes() {
  const oneTimeCode = process.env.FLUXPOINT_DOCS_TOTP_CODE?.trim();
  if (oneTimeCode) return [oneTimeCode];

  const secret = cleanTotpSecret(process.env.FLUXPOINT_DOCS_TOTP_SECRET);
  return secret ? [0, -1, 1, -2, 2].map((offset) => generateTotp(secret, offset)) : [];
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

  await page.goto(new URL("/login?returnTo=%2Fdashboard", baseUrl).toString(), { waitUntil: "networkidle", timeout: 30_000 });
  await maybeFill(page, 'input[name="email"]', email);
  await maybeFill(page, 'input[name="password"]', password);

  const startingUrl = page.url();
  const submit = page.getByRole("button", { name: /log in|sign in/i });
  if ((await submit.count()) > 0) {
    await submit.first().click();
  } else {
    await page.locator('button[type="submit"], input[type="submit"]').first().click();
  }
  await page
    .waitForURL((url) => {
      if (url.href !== startingUrl) return true;
      if (url.pathname === "/two-factor") return true;
      if (url.pathname === "/login" && (url.searchParams.has("error") || url.searchParams.has("twoFactor"))) return true;
      return false;
    }, { timeout: 15_000 })
    .catch(() => null);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => null);
  await completeTwoFactorIfNeeded(page);

  if (page.url().includes("/login")) {
    const visibleText = await visiblePageText(page);
    const loginError = visibleText.includes("That email or password was not recognized") ? " The login page says: That email or password was not recognized." : "";
    throw new Error(`Documentation account is still on the login page after sign-in.${loginError} Current URL: ${page.url()}. Check FLUXPOINT_DOCS_EMAIL, FLUXPOINT_DOCS_PASSWORD, ADMIN_EMAIL, and ADMIN_PASSWORD.${visibleText ? ` Visible page text: ${visibleText.slice(0, 500)}` : ""}`);
  }

  console.log(`Documentation account signed in; current page is ${page.url()}`);
}

async function completeTwoFactorIfNeeded(page: ManualPage) {
  const codeInput = page.locator('input[name="code"], input[autocomplete="one-time-code"]');
  if (!page.url().includes("/two-factor") && (await codeInput.count()) === 0) return;

  const codes = docsTotpCodes();
  if (codes.length === 0) {
    throw new Error("Screenshot capture reached two-factor verification. Set FLUXPOINT_DOCS_TOTP_SECRET for the docs account or FLUXPOINT_DOCS_TOTP_CODE for a one-time run.");
  }

  console.log("Completing two-factor verification for documentation capture.");
  for (const code of codes) {
    const startingUrl = page.url();
    await codeInput.first().fill(code);
    const verify = page.getByRole("button", { name: /verify/i });
    if ((await verify.count()) > 0) {
      await verify.first().click();
    } else {
      await page.locator('button[type="submit"], input[type="submit"]').first().click();
    }
    await page
      .waitForURL((url) => {
        if (!url.pathname.includes("/two-factor")) return true;
        if (url.href !== startingUrl && url.searchParams.has("error")) return true;
        return false;
      }, { timeout: 10_000 })
      .catch(() => null);
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => null);
    if (!page.url().includes("/two-factor")) return;
  }

  const visibleText = await visiblePageText(page);
  throw new Error(`Two-factor verification failed for documentation capture. Check FLUXPOINT_DOCS_TOTP_SECRET or FLUXPOINT_DOCS_TOTP_CODE.${visibleText ? ` Visible page text: ${visibleText.slice(0, 500)}` : ""}`);
}

async function visiblePageText(page: ManualPage) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}

async function openManualScreenshotPage(page: ManualPage, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => null);
  await page.locator("main, body").first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => null);
  await page.waitForTimeout(500);
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
        console.log(`Capturing ${section.title}: ${url}`);
        await openManualScreenshotPage(page, url);
      } catch (error) {
        throw new Error(`Unable to load ${url}. Start Fluxpoint or set FLUXPOINT_DOCS_BASE_URL to a reachable app URL.`, { cause: error });
      }
      await completeTwoFactorIfNeeded(page);
      if (page.url().includes("/login")) {
        throw new Error(`Documentation capture was redirected to login while opening ${section.title}. Check the docs account credentials and privileges.`);
      }
      if (page.url().includes("/two-factor")) {
        throw new Error(`Documentation capture was still on two-factor verification while opening ${section.title}. Check FLUXPOINT_DOCS_TOTP_SECRET or FLUXPOINT_DOCS_TOTP_CODE.`);
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
