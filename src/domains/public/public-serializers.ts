import type { Aquarium, AquariumItem, AquariumItemPublicProfile, AquariumPublicProfile, Collection, CollectionPublicProfile, EquipmentProfile, MediaAsset, SpeciesDefinition, SpeciesVariant } from "@prisma/client";
import { habitatsForSalinity } from "@/domains/species/habitat";
import { buildLocationPath } from "@/lib/format/location";
import { mediaDeliveryUrl, publicMediaDeliveryUrl } from "@/domains/media/media-urls";

type AquariumWithPublic = Aquarium & {
  publicProfile: AquariumPublicProfile | null;
  coverMediaAsset: MediaAsset | null;
  structuredLocation?: { name: string; parent?: any } | null;
  items?: PublicAquariumItem[];
  equipmentAttachments?: Array<{ id: string; role: string; item: PublicAquariumItem }>;
  lightingAssignments?: Array<{
    id: string;
    enabled: boolean;
    equipmentItem: (AquariumItem & { equipmentProfile?: EquipmentProfile | null }) | null;
    schedule: {
      id: string;
      name: string;
      description: string | null;
      rampMinutes: number;
      capabilityProfile: { channels: unknown; mode?: string } | null;
      points: Array<{ id: string; timeOfDay: string; white: number; red: number; green: number; blue: number; warmWhite: number | null; intensity: number | null; rampMinutes: number; values: unknown }>;
    } | null;
  }>;
  readings?: Array<{ parameter: string; value: number; unit: string; measuredAt: Date }>;
  events?: Array<{ id: string; title: string; summary: string | null; eventType: string; eventDate: Date }>;
  mediaAssets?: Array<MediaAsset & {
    item?: { name: string; itemType: string } | null;
    aquariumEvent?: { title: string; eventDate: Date } | null;
    speciesDefinition?: { id: string; commonName: string; scientificName: string | null } | null;
    speciesLinks?: Array<{ speciesDefinition: { id: string; commonName: string; scientificName: string | null }; speciesVariant?: { id: string; displayName: string | null; name: string } | null }>;
  }>;
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

function publicAssetUrl(url: string | null | undefined, version: string, preview: boolean) {
  return preview ? mediaDeliveryUrl(url, version) : publicMediaDeliveryUrl(url, version);
}

function approvedCover(aquarium: AquariumWithPublic, preview: boolean) {
  const asset = aquarium.coverMediaAsset;
  if (!asset || asset.moderationStatus !== "APPROVED" || asset.hiddenAt || asset.visibility === "PRIVATE") return null;
  return { url: publicAssetUrl(asset.thumbnailUrl || asset.url, asset.id, preview), alt: asset.altText || `${aquarium.name} aquarium cover`, caption: asset.caption };
}

export function serializePublicInhabitant(item: PublicAquariumItem) {
  return {
    publicKey: [item.itemType, item.publicProfile?.publicTitle || item.name, item.speciesDefinition?.scientificName].filter(Boolean).join(":"),
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
    publicKey: [item.itemType, item.publicProfile?.publicTitle || item.name, item.equipmentProfile?.brand, item.equipmentProfile?.model].filter(Boolean).join(":"),
    name: item.publicProfile?.publicTitle || item.name,
    equipmentType: item.equipmentProfile?.equipmentType ?? item.itemType,
    brand: item.equipmentProfile?.brand ?? null,
    model: item.equipmentProfile?.model ?? null,
    description: item.publicProfile?.publicDescription || item.description || null
  };
}

function serializePublicLightingAssignment(assignment: NonNullable<AquariumWithPublic["lightingAssignments"]>[number]) {
  if (!assignment.enabled || !assignment.schedule) return null;
  return {
    publicKey: [assignment.equipmentItem?.name, assignment.schedule.name].filter(Boolean).join(":"),
    fixtureName: assignment.equipmentItem?.name ?? "Light fixture",
    fixtureType: assignment.equipmentItem?.equipmentProfile?.equipmentType ?? null,
    schedule: {
      name: assignment.schedule.name,
      description: assignment.schedule.description,
      rampMinutes: assignment.schedule.rampMinutes,
      capabilityProfile: assignment.schedule.capabilityProfile,
      points: assignment.schedule.points.map((point) => ({ ...point, id: point.timeOfDay }))
    }
  };
}

export function serializePublicMetricSummary(reading: { parameter: string; value: number; unit: string; measuredAt: Date }) {
  return { parameter: reading.parameter, value: reading.value, unit: reading.unit, measuredAt: reading.measuredAt.toISOString() };
}

export function serializePublicTimelineEvent(event: { title: string; summary: string | null; eventType: string; eventDate: Date }) {
  return { publicKey: `${event.eventDate.toISOString()}:${event.title}`, title: event.title, summary: event.summary, type: event.eventType, date: event.eventDate.toISOString() };
}

function serializePublicPhoto(asset: NonNullable<AquariumWithPublic["mediaAssets"]>[number], hideMetadata: boolean, hideUploadDates: boolean, preview: boolean) {
  const species = [
    asset.speciesDefinition ? { label: asset.speciesDefinition.commonName || asset.speciesDefinition.scientificName || "Species" } : null,
    ...(asset.speciesLinks || []).map((link) => ({ label: [link.speciesDefinition.commonName, link.speciesVariant?.displayName || link.speciesVariant?.name].filter(Boolean).join(" · ") || link.speciesDefinition.scientificName || "Species" }))
  ].filter(Boolean);
  return {
    publicKey: publicAssetUrl(asset.url, asset.id, preview),
    url: publicAssetUrl(asset.thumbnailUrl || asset.url, asset.id, preview),
    fullUrl: publicAssetUrl(asset.url, asset.id, preview),
    alt: asset.altText || asset.caption || "Aquarium photo",
    caption: asset.caption,
    description: hideMetadata ? null : asset.description,
    photographer: hideMetadata ? null : asset.photographer,
    capturedAt: hideMetadata || !asset.captureDate ? null : asset.captureDate.toISOString(),
    uploadedAt: hideUploadDates ? null : asset.createdAt.toISOString(),
    tags: hideMetadata || !Array.isArray(asset.tags) ? [] : asset.tags.map(String).filter(Boolean),
    species,
    item: hideMetadata || !asset.item ? null : `${asset.item.name} · ${asset.item.itemType.toLowerCase()}`,
    event: hideMetadata || !asset.aquariumEvent ? null : `${asset.aquariumEvent.title} · ${asset.aquariumEvent.eventDate.toISOString()}`
  };
}

export function serializePublicAquarium(aquarium: AquariumWithPublic, collectionSettings?: NonNullable<ReturnType<typeof serializePublicCollection>>["settings"], options: { preview?: boolean } = {}) {
  const profile = aquarium.publicProfile;
  if (!profile) return null;
  const title = profile.publicTitle || aquarium.name;
  const publishedItems = (aquarium.items || []).filter((item) => options.preview || item.publicProfile?.isPublished);
  const attachedEquipment = (aquarium.equipmentAttachments || []).map((attachment) => attachment.item).filter((item) => options.preview || item.publicProfile?.isPublished);
  const publicEquipmentItems = Array.from(new Map([...publishedItems.filter((item) => ["EQUIPMENT", "SUBSTRATE", "HARDSCAPE"].includes(item.itemType)), ...attachedEquipment].map((item) => [item.id, item])).values());
  const inhabitants = publishedItems.filter((item) => ["FISH", "INVERT", "CORAL"].includes(item.itemType)).map(serializePublicInhabitant);
  const plants = publishedItems.filter((item) => item.itemType === "PLANT").map(serializePublicInhabitant);
  const equipment = publicEquipmentItems.map(serializePublicEquipment);
  const schedules = (aquarium.lightingAssignments || []).map(serializePublicLightingAssignment).filter(Boolean);
  const inhabitantCount = inhabitants.reduce((sum, item) => sum + (typeof item.quantity === "number" ? item.quantity : 1), 0);
  return {
    slug: profile.publicSlug,
    title,
    subtitle: profile.publicSubtitle,
    description: profile.publicDescription || aquarium.description,
    habitat: habitatsForSalinity(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt),
    tankType: aquarium.aquariumType,
    volume: aquarium.volumeGallons ? `${aquarium.volumeGallons} ${aquarium.volumeUnit === "LITER" ? "L" : "gal"}` : null,
    location: aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation as any) : null,
    cover: profile.showCoverPhoto ? approvedCover(aquarium, Boolean(options.preview)) : null,
    inhabitants: profile.showInhabitants ? inhabitants : [],
    inhabitantCount: profile.showInhabitants ? inhabitantCount : 0,
    plants: profile.showPlants ? plants : [],
    equipment: (profile.showEquipment || collectionSettings?.equipment) ? equipment : [],
    schedules: profile.showSchedules ? schedules : [],
    photos: profile.showPhotoGallery ? (aquarium.mediaAssets || [])
      .filter((asset) => asset.moderationStatus === "APPROVED" && !asset.hiddenAt && asset.visibility !== "PRIVATE")
      .map((asset) => serializePublicPhoto(asset, profile.hidePhotoMetadata, profile.hidePhotoUploadDates, Boolean(options.preview))) : [],
    metrics: (profile.showMetrics || collectionSettings?.metrics) ? (aquarium.readings || []).map(serializePublicMetricSummary) : [],
    timeline: (profile.showTimeline || collectionSettings?.timeline) ? (aquarium.events || []).map(serializePublicTimelineEvent) : [],
    settings: {
      showStockingPressure: profile.showStockingPressure,
      showEddySummary: profile.showEddySummary,
      showPhotoGallery: profile.showPhotoGallery,
      showSchedules: profile.showSchedules,
      showConditions: profile.showConditions
    }
  };
}
