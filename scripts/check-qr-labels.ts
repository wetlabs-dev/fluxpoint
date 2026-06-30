import { readFile } from "fs/promises";
import { canonicalEntityPath, normalizeScannableEntityType, qrScanPath, qrScanUrl } from "../src/domains/qr/qr-service";
import { labelTypeLabels } from "../src/domains/labels/label-types";
import { labelPrintFormatLabels, normalizeLabelFormat, normalizeLabelMode, normalizeLabelOrientation } from "../src/domains/labels/label-formats";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  assert(normalizeScannableEntityType("Aquarium") === "TANK", "Legacy aquarium QR types must normalize to TANK.");
  assert(normalizeScannableEntityType("AquariumItem") === "INVENTORY", "Legacy item QR types must normalize to INVENTORY.");
  assert(qrScanPath("EQUIPMENT", "abc123") === "/q/equipment/abc123", "Equipment scan paths must use public codes.");
  assert(/^https?:\/\//.test(qrScanUrl("INVENTORY", "abc123")), "QR payloads must be usable web URLs, not custom URI schemes.");
  assert(qrScanUrl("INVENTORY", "abc123").includes("/q/inventory/abc123"), "QR payload URLs must preserve the scannable route.");
  assert(canonicalEntityPath("INVENTORY", "item-1") === "/inventory/item-1", "Inventory QR destinations must open detail pages.");
  assert(canonicalEntityPath("TANK", "tank-1") === "/aquariums/tank-1", "Tank QR destinations must open aquarium workspaces.");
  assert(Object.keys(labelTypeLabels).length === 5 && labelTypeLabels.AQUARIUM_LIVESTOCK_SHEET, "The required printable label formats are missing.");
  assert(labelPrintFormatLabels.ONE_PER_PAGE_2_25X1_25.includes("2.25 x 1.25"), "The AxilDB fixed label format must be available.");
  assert(labelPrintFormatLabels.LEGACY_PRINT_SHEET.includes("Legacy"), "The legacy ganged sheet format must be available.");
  assert(labelPrintFormatLabels.BROTHER_DK_2210.includes("Brother DK-2210"), "The Brother DK-2210 format must be available.");
  assert(labelPrintFormatLabels.QR_ONLY_SQUARE.includes("QR-only"), "QR-only square labels must remain available.");
  assert(normalizeLabelMode("qr-only") === "QR_ONLY", "QR-only mode must normalize.");
  assert(normalizeLabelFormat("brother-dk-2210", "FULL") === "BROTHER_DK_2210", "Brother format must normalize from AxilDB-style values.");
  assert(normalizeLabelOrientation("portrait", "ONE_PER_PAGE_2_25X1_25") === "PORTRAIT", "Portrait orientation must normalize.");

  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  assert(/publicCode\s+String\s+@unique/.test(schema), "Stable QR public codes must remain unique.");
  assert(schema.includes("@@unique([entityType, entityId])"), "Each entity must reuse one stable QR record.");
  assert(schema.includes("model GeneratedLabel"), "Generated label metadata must remain durable.");

  const middleware = await readFile(new URL("../src/middleware.ts", import.meta.url), "utf8");
  assert(middleware.includes('matcher: ["/labels/:path*"]'), "Generated label files must not be publicly addressable.");

  const labelService = await readFile(new URL("../src/domains/labels/label-service.ts", import.meta.url), "utf8");
  assert(!labelService.includes("drawText(publicCode"), "Visible public-code text must not be printed below QR codes.");
  assert(!labelService.includes("#062f35"), "Generated label QR codes must stay black-and-white for print.");
  assert(labelService.includes("generateBulkLabels"), "Bulk label PDF generation must remain implemented.");
  assert(labelService.includes("BULK_LABEL_BATCH_GENERATED"), "Bulk label generation must be audited.");

  const labelsPage = await readFile(new URL("../src/app/(app)/labels/page.tsx", import.meta.url), "utf8");
  assert(labelsPage.includes("Generate selected labels"), "The batch label page must expose manual selected-record generation.");
  assert(labelsPage.includes("LabelFormatSelector"), "The batch label page must expose the label format selector.");
  assert(labelsPage.includes("?download=1"), "The label UI must expose a download path for installed PWA/browser quirks.");

  console.log("Inventory detail, stable web QR routing, private label storage, bulk label, and hidden-code checks passed.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
