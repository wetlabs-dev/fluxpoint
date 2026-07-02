import { readFile } from "node:fs/promises";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

async function main() {
  const schema = await read("../prisma/schema.prisma");
  assert(schema.includes("enum PublicLocationMode"), "Public location mode enum must exist.");
  assert(schema.includes("model CollectionPublicProfile"), "Collection public profile model must exist.");
  assert(schema.includes("model AquariumPublicProfile"), "Aquarium public profile model must exist.");
  assert(schema.includes("model AquariumItemPublicProfile"), "Public item profile model must exist.");
  assert(schema.includes("allowSearchIndexing Boolean"), "Public browse must keep search indexing opt-in.");
  assert(schema.includes("showQrLandingPages  Boolean"), "QR public landing pages must be collection-controlled.");

  const serializers = await read("../src/domains/public/public-serializers.ts");
  assert(serializers.includes("serializePublicCollection"), "Public collection serializer must exist.");
  assert(serializers.includes("serializePublicAquarium"), "Public aquarium serializer must exist.");
  assert(!serializers.includes("purchasePrice"), "Public serializers must not expose inventory prices.");
  assert(!serializers.includes("acquiredFrom"), "Public serializers must not expose vendors or sources.");
  assert(!serializers.includes("notes"), "Public serializers must not expose private notes.");
  assert(serializers.includes("moderationStatus !== \"APPROVED\""), "Public covers must require approved media.");
  assert(serializers.includes("visibility === \"PRIVATE\""), "Private media must be excluded from public covers.");

  const publicCollection = await read("../src/app/browse/[publicSlug]/page.tsx");
  assert(publicCollection.includes("isPublicEnabled"), "Public collection route must require enabled public browse.");
  assert(publicCollection.includes("allowSearchIndexing"), "Public collection metadata must honor search indexing preference.");

  const publicQueries = await read("../src/domains/public/queries.ts");
  assert(publicQueries.includes("isPublished: true"), "Public aquarium route must require published aquariums.");
  const publicAquariumView = await read("../src/components/public/PublicAquariumView.tsx");
  assert(publicAquariumView.includes("Preview — not public unless published."), "Public preview must carry a clear preview banner.");

  const qrScan = await read("../src/domains/qr/scan.ts");
  assert(qrScan.includes("publicAquariumPath"), "Anonymous tank QR scans must be able to route to public aquariums.");
  assert(qrScan.includes("/public/q/"), "Anonymous public item QR scans must route to safe item landing pages.");
  assert(qrScan.includes("showQrLandingPages"), "QR public routing must respect the collection QR preference.");

  const inventoryForm = await read("../src/components/inventory/InventoryItemForm.tsx");
  const receipt = await read("../src/components/inventory/ItemizedReceipt.tsx");
  assert(inventoryForm.includes("Unit price"), "Inventory creation form must label purchase price as unit price.");
  assert(receipt.includes("Itemized receipt"), "Tank receipt view must exist.");
  assert(receipt.includes("Unit price × quantity"), "Receipt must explain how totals are calculated.");

  console.log("Public browse, QR safety, and inventory receipt checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
