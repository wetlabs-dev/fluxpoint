import { readFile } from "fs/promises";
import { canonicalEntityPath, normalizeScannableEntityType, qrScanPath } from "../src/domains/qr/qr-service";
import { labelTypeLabels } from "../src/domains/labels/label-types";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  assert(normalizeScannableEntityType("Aquarium") === "TANK", "Legacy aquarium QR types must normalize to TANK.");
  assert(normalizeScannableEntityType("AquariumItem") === "INVENTORY", "Legacy item QR types must normalize to INVENTORY.");
  assert(qrScanPath("EQUIPMENT", "abc123") === "/q/equipment/abc123", "Equipment scan paths must use public codes.");
  assert(canonicalEntityPath("INVENTORY", "item-1") === "/inventory/item-1", "Inventory QR destinations must open detail pages.");
  assert(canonicalEntityPath("TANK", "tank-1") === "/aquariums/tank-1", "Tank QR destinations must open aquarium workspaces.");
  assert(Object.keys(labelTypeLabels).length === 5 && labelTypeLabels.AQUARIUM_LIVESTOCK_SHEET, "The required printable label formats are missing.");

  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  assert(/publicCode\s+String\s+@unique/.test(schema), "Stable QR public codes must remain unique.");
  assert(schema.includes("@@unique([entityType, entityId])"), "Each entity must reuse one stable QR record.");
  assert(schema.includes("model GeneratedLabel"), "Generated label metadata must remain durable.");

  const middleware = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  assert(middleware.includes('matcher: ["/labels/:path*"]'), "Generated label files must not be publicly addressable.");

  console.log("Inventory detail, stable QR routing, private label storage, and label format checks passed.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
