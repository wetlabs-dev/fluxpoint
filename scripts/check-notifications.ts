import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { notificationRows, validTime, validTimeZone } from "../src/domains/notifications/preferences";
import { isInQuietHours } from "../src/domains/notifications/notification-service";
import { prisma } from "../src/lib/db/prisma";

async function main() {
  assert.equal(notificationRows.length, 18);
  assert.equal(new Set(notificationRows.map((row) => row.type)).size, notificationRows.length);
  for (const type of ["CONDITION_FOLLOW_UP", "CONDITION_CRITICAL_ALERT", "CONDITION_WORSENING_ALERT"]) assert.ok(notificationRows.some((row) => row.type === type));
  for (const type of ["AQUARIUM_HEALTH_CRITICAL", "AQUARIUM_HEALTH_CONCERN", "AQUARIUM_PARAMETER_DRIFT", "AQUARIUM_PARAMETER_INSTABILITY", "AQUARIUM_INTELLIGENCE_FAILURE", "AQUARIUM_INTELLIGENCE_DIGEST"]) assert.ok(notificationRows.some((row) => row.type === type));
  assert.equal(validTime("23:59"), "23:59");
  assert.equal(validTime("24:00"), null);
  assert.equal(validTimeZone("UTC"), "UTC");
  assert.equal(validTimeZone("Not/AZone"), "America/New_York");
  assert.equal(isInQuietHours({ timezone: "UTC", quietHoursStart: "22:00", quietHoursEnd: "06:00" }, new Date("2026-06-20T23:00:00Z")), true);
  assert.equal(isInQuietHours({ timezone: "UTC", quietHoursStart: "22:00", quietHoursEnd: "06:00" }, new Date("2026-06-20T12:00:00Z")), false);
  const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable"));
  const worker = await readFile("public/sw.js", "utf8");
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /notificationclick/);
  assert.doesNotMatch(worker, /caches\./);
  for (const icon of ["app-icon-192.png", "app-icon-512.png", "app-icon-1024.png", "apple-touch-icon.png"]) assert.ok((await stat(`public/${icon}`)).size > 1_000);
  console.log("Fluxpoint PWA and notification checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
