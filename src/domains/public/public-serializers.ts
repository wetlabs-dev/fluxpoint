import type { Aquarium, AquariumItem, AquariumItemPublicProfile, AquariumPublicProfile, Collection, CollectionPublicProfile, EquipmentProfile, MediaAsset, SpeciesDefinition, SpeciesVariant } from "@prisma/client";
import { habitatsForSalinity } from "@/domains/species/habitat";
import { buildLocationPath } from "@/lib/format/location";

type AquariumWithPublic = Aquarium & {
  publicProfile: AquariumPublicProfile | null;
  coverMediaAsset: MediaAsset | null;
  structuredLocation?: { name: string; parent?: any } | null;
  items?: PublicAquariumItem[];
  readings?: Array<{ parameter: string; value: number; unit: string; measuredAt: Date }>;
  events?: Array<{ id: string; title: string; summary: string | null; eventType: string; eventDate: Date }>;
};

type PublicAquariumItem = AquariumItem & {
  publicProfile: AquariumItemPublicProfile | null;
  speciesDefinition: SpeciesDefinition | null;
  speciesVariant: SpeciesVariant | null;
  equipmentProfile?: EquipmentProfile | null;
};

export function serializePublicCollection(collection: Collection & { publicProfile: CollectionPublicProfile | null; owner?: { name: string } | null }) {
  const profile = collection.publicProfile;
  if (!profile) return null;
  const location = profile.publicLocationMode === "HIDDEN"
    ? null
    : profile.publicLocationMode === "REGION_ONLY"
      ? [collection.localityRegion, collection.localityCountry].filter(Boolean).join(", ")
      : collection.localityLabel || [collection.localityCity, collection.localityRegion, collection.localityCountry].filter(Boolean).join(", ");
  return {
    slug: profile.publicSlug,
    displayName: profile.displayName || collection.name,
    tagline: profile.tagline,
    description: profile.description,
    location: location || null,
    ownerName: profile.showOwnerName ? collection.owner?.name ?? null : null,
    settings: {
      tankList: profile.showTankList,
      speciesList: profile.showSpeciesList,
      metrics: profile.showMetrics,
      timeline: profile.showTimeline,
      equipment: profile.showEquipment,
      qrLandingPages: profile.showQrLandingPages,
      allowSearchIndexing: profile.allowSearchIndexing
    }
  };
}

function approvedCover(aquarium: AquariumWithPublic) {
  const asset = aquarium.coverMediaAsset;
  if (!asset || asset.moderationStatus !== "APPROVED" || asset.hiddenAt || asset.visibility === "PRIVATE") return null;
  return { url: asset.thumbnailUrl || asset.url, alt: asset.altText || `${aquarium.generatedName ?? aquarium.name} aquarium cover`, caption: asset.caption };
}

export function serializePublicInhabitant(item: PublicAquariumItem) {
  return {
    id: item.id,
    name: item.publicProfile?.publicTitle || item.name,
    itemType: item.itemType,
    quantity: item.publicProfile?.showQuantity === false ? null : item.quantity,
    unit: item.unit,
    commonName: item.speciesDefinition?.commonName ?? null,
    scientificName: item.speciesDefinition?.scientificName ?? null,
    variantName: item.speciesVariant?.displayName || item.speciesVariant?.name || null,
    description: item.publicProfile?.publicDescription || item.description || null
  };
}

export function serializePublicEquipment(item: PublicAquariumItem) {
  return {
    id: item.id,
    name: item.publicProfile?.publicTitle || item.name,
    equipmentType: item.equipmentProfile?.equipmentType ?? item.itemType,
    brand: item.equipmentProfile?.brand ?? null,
    model: item.equipmentProfile?.model ?? null,
    description: item.publicProfile?.publicDescription || item.description || null
  };
}

export function serializePublicMetricSummary(reading: { parameter: string; value: number; unit: string; measuredAt: Date }) {
  return { parameter: reading.parameter, value: reading.value, unit: reading.unit, measuredAt: reading.measuredAt.toISOString() };
}

export function serializePublicTimelineEvent(event: { id: string; title: string; summary: string | null; eventType: string; eventDate: Date }) {
  return { id: event.id, title: event.title, summary: event.summary, type: event.eventType, date: event.eventDate.toISOString() };
}

export function serializePublicAquarium(aquarium: AquariumWithPublic, collectionSettings?: NonNullable<ReturnType<typeof serializePublicCollection>>["settings"], options: { preview?: boolean } = {}) {
  const profile = aquarium.publicProfile;
  if (!profile) return null;
  const title = profile.publicTitle || aquarium.generatedName || aquarium.name;
  const publishedItems = (aquarium.items || []).filter((item) => options.preview || item.publicProfile?.isPublished);
  const inhabitants = publishedItems.filter((item) => ["FISH", "INVERT", "CORAL"].includes(item.itemType)).map(serializePublicInhabitant);
  const plants = publishedItems.filter((item) => item.itemType === "PLANT").map(serializePublicInhabitant);
  const equipment = publishedItems.filter((item) => ["EQUIPMENT", "SUBSTRATE", "HARDSCAPE"].includes(item.itemType)).map(serializePublicEquipment);
  return {
    id: aquarium.id,
    slug: profile.publicSlug,
    title,
    subtitle: profile.publicSubtitle,
    description: profile.publicDescription || aquarium.description,
    habitat: habitatsForSalinity(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt),
    tankType: aquarium.aquariumType,
    volume: aquarium.volumeGallons ? `${aquarium.volumeGallons} ${aquarium.volumeUnit === "LITER" ? "L" : "gal"}` : null,
    location: aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation as any) : null,
    cover: profile.showCoverPhoto ? approvedCover(aquarium) : null,
    inhabitants: profile.showInhabitants ? inhabitants : [],
    plants: profile.showPlants ? plants : [],
    equipment: (profile.showEquipment || collectionSettings?.equipment) ? equipment : [],
    metrics: (profile.showMetrics || collectionSettings?.metrics) ? (aquarium.readings || []).map(serializePublicMetricSummary) : [],
    timeline: (profile.showTimeline || collectionSettings?.timeline) ? (aquarium.events || []).map(serializePublicTimelineEvent) : [],
    settings: {
      showStockingPressure: profile.showStockingPressure,
      showEddySummary: profile.showEddySummary,
      showSchedules: profile.showSchedules,
      showConditions: profile.showConditions
    }
  };
}
