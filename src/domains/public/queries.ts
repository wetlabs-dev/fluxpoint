import { prisma } from "@/lib/db/prisma";
import { serializePublicAquarium, serializePublicCollection } from "@/domains/public/public-serializers";

export async function loadPublicAquarium(publicSlug: string, aquariumSlug: string, previewAquariumId?: string) {
  const profile = await prisma.collectionPublicProfile.findUnique({ where: { publicSlug }, include: { collection: { include: { owner: { select: { name: true } } } } } });
  if (!profile?.isPublicEnabled && !previewAquariumId) return null;
  const aquarium = await prisma.aquarium.findFirst({
    where: previewAquariumId ? { id: previewAquariumId } : { collectionId: profile!.collectionId, publicProfile: { publicSlug: aquariumSlug, isPublished: true } },
    include: {
      publicProfile: true,
      coverMediaAsset: true,
      structuredLocation: { include: { parent: { include: { parent: true } } } },
      items: { where: previewAquariumId ? {} : { publicProfile: { isPublished: true } }, include: { publicProfile: true, speciesDefinition: true, speciesVariant: true, equipmentProfile: true }, orderBy: [{ itemType: "asc" }, { name: "asc" }] },
      equipmentAttachments: { include: { item: { include: { publicProfile: true, speciesDefinition: true, speciesVariant: true, equipmentProfile: true } } }, orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      lightingAssignments: { include: { equipmentItem: { include: { equipmentProfile: true } }, schedule: { include: { capabilityProfile: true, points: { orderBy: { sortOrder: "asc" } } } } }, orderBy: { createdAt: "asc" } },
      mediaAssets: {
        where: previewAquariumId ? {} : { moderationStatus: "APPROVED", hiddenAt: null, visibility: { not: "PRIVATE" } },
        include: {
          item: { select: { name: true, itemType: true } },
          aquariumEvent: { select: { title: true, eventDate: true } },
          speciesDefinition: { select: { id: true, commonName: true, scientificName: true } },
          speciesLinks: { include: { speciesDefinition: { select: { id: true, commonName: true, scientificName: true } }, speciesVariant: { select: { id: true, displayName: true, name: true } } } }
        },
        orderBy: [{ captureDate: "desc" }, { createdAt: "desc" }],
        take: 48
      },
      readings: { orderBy: { measuredAt: "desc" }, take: 8 },
      events: { where: { eventType: { in: ["NOTE", "PHOTO", "MAINTENANCE", "WATER_CHANGE", "STOCKING"] } }, orderBy: { eventDate: "desc" }, take: 8 }
    }
  });
  if (!aquarium?.publicProfile) return null;
  const collection = serializePublicCollection({ ...profile!.collection, publicProfile: profile });
  if (!collection) return null;
  return { collection, aquarium: serializePublicAquarium(aquarium, collection.settings, { preview: Boolean(previewAquariumId) }) };
}
