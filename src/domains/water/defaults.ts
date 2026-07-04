import { prisma } from "@/lib/db/prisma";

export async function ensureDefaultWaterSources(collectionId: string) {
  await prisma.waterSource.upsert({
    where: { collectionId_name: { collectionId, name: "RODI" } },
    create: {
      collectionId,
      name: "RODI",
      description: "Reverse osmosis/deionized source water.",
      sourceType: "RODI",
      isDefault: true
    },
    update: {}
  });
  await prisma.waterSource.upsert({
    where: { collectionId_name: { collectionId, name: "Dechlorinated Tap" } },
    create: {
      collectionId,
      name: "Dechlorinated Tap",
      description: "Tap water after dechlorination or conditioner treatment.",
      sourceType: "TAP",
      isDefault: false
    },
    update: {}
  });
}
