import { prisma } from "@/lib/db/prisma";
import { getHusbandryFieldsForSpeciesType, inferSpeciesHusbandryType } from "@/domains/husbandry/husbandry-fields";
import { getEffectiveHusbandryForItem } from "@/domains/husbandry/husbandry-service";
import type { EddyAquariumContext, EddySpeciesContext } from "@/domains/eddy/eddy-types";

export async function buildEddyAquariumContext(aquariumId: string, userId: string): Promise<EddyAquariumContext> {
  const collection = await prisma.collection.findFirstOrThrow({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId: collection.id },
    include: {
      profile: true,
      structuredLocation: true,
      items: { where: { status: "ACTIVE" }, include: { equipmentProfile: true, speciesDefinition: true } },
      lightingAssignments: { include: { schedule: { include: { points: { orderBy: { sortOrder: "asc" } } } }, equipmentItem: true } },
      readings: { orderBy: { measuredAt: "desc" }, take: 80 },
      events: { orderBy: { eventDate: "desc" }, take: 20 },
      careTasks: { where: { status: "PENDING" }, include: { careSchedule: true }, orderBy: { dueAt: "asc" }, take: 20 },
      quarantineProjects: { where: { status: "ACTIVE" }, include: { items: { include: { item: true } } } },
      medicationCourses: { where: { status: "ACTIVE" }, include: { medicationDefinition: true } }
    }
  });
  const latest = new Map<string, (typeof aquarium.readings)[number]>();
  for (const reading of aquarium.readings) if (!latest.has(reading.parameter)) latest.set(reading.parameter, reading);
  const inhabitants = aquarium.items.filter((item) => ["FISH", "INVERT", "PLANT", "BOTANICAL", "OTHER"].includes(item.itemType));
  const husbandry = await Promise.all(inhabitants.filter((item) => item.speciesDefinitionId).map(async (item) => {
    const resolved = await getEffectiveHusbandryForItem(item.id);
    return { item: item.name, species: item.speciesDefinition?.commonName, speciesType: resolved?.speciesType, fields: resolved?.fields };
  }));
  return {
    kind: "aquarium",
    aquarium: { id: aquarium.id, name: aquarium.generatedName ?? aquarium.name, tankType: aquarium.tankType, volumeGallons: aquarium.volumeGallons, dimensionsInches: [aquarium.lengthInches, aquarium.widthInches, aquarium.heightInches], location: aquarium.structuredLocation?.name ?? aquarium.location, status: aquarium.status, startedAt: aquarium.startedAt, description: aquarium.description, notes: aquarium.notes },
    profile: aquarium.profile,
    inhabitants: inhabitants.map((item) => ({ type: item.itemType, name: item.name, quantity: item.quantity, species: item.speciesDefinition?.commonName, temperature: [item.speciesDefinition?.tempMin, item.speciesDefinition?.tempMax], ph: [item.speciesDefinition?.phMin, item.speciesDefinition?.phMax], gh: [item.speciesDefinition?.ghMin, item.speciesDefinition?.ghMax], kh: [item.speciesDefinition?.khMin, item.speciesDefinition?.khMax], minimumGroupSize: item.speciesDefinition?.minimumGroupSize })),
    equipment: aquarium.items.filter((item) => item.itemType === "EQUIPMENT").map((item) => ({ name: item.name, profile: item.equipmentProfile })),
    lighting: aquarium.lightingAssignments.map((item) => ({ equipment: item.equipmentItem?.name, schedule: item.schedule?.name, points: item.schedule?.points, notes: item.notes })),
    latestParameters: [...latest.values()].map((reading) => ({ parameter: reading.parameter, value: reading.value, unit: reading.unit, measuredAt: reading.measuredAt })),
    recentEvents: aquarium.events.map((event) => ({ type: event.eventType, title: event.title, summary: event.summary, date: event.eventDate })),
    careTasks: aquarium.careTasks.map((task) => ({ title: task.title, dueAt: task.dueAt, schedule: task.careSchedule.name, type: task.careSchedule.scheduleType })),
    husbandry,
    quarantine: aquarium.quarantineProjects.map((project) => ({ name: project.name, reason: project.reason, notes: project.notes, items: project.items.map((entry) => entry.item.name) })),
    medications: aquarium.medicationCourses.map((course) => ({ title: course.title, medication: course.medicationDefinition.name, reason: course.reason, status: course.status, notes: course.notes, safetyNotes: course.medicationDefinition.safetyNotes }))
  };
}

export async function buildEddySpeciesContext(speciesDefinitionId: string, userId: string, requestedType?: string): Promise<EddySpeciesContext> {
  const collection = await prisma.collection.findFirstOrThrow({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
  const definition = await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId: collection.id }, { collectionId: null }] }, include: { husbandryGuide: true } });
  const speciesType = requestedType || definition.husbandryGuide?.speciesType || inferSpeciesHusbandryType(definition);
  return {
    kind: "species",
    species: { id: definition.id, category: definition.category, commonName: definition.commonName, scientificName: definition.scientificName, notes: definition.notes, careNotes: definition.careNotes, minimumGroupSize: definition.minimumGroupSize, temperature: [definition.tempMin, definition.tempMax], ph: [definition.phMin, definition.phMax], gh: [definition.ghMin, definition.ghMax], kh: [definition.khMin, definition.khMax], lightRequirement: definition.lightRequirement, flowRequirement: definition.flowRequirement },
    speciesType: String(speciesType),
    requestedFields: getHusbandryFieldsForSpeciesType(speciesType as never).map(({ key, label }) => ({ key, label })),
    currentHusbandry: definition.husbandryGuide ? { summary: definition.husbandryGuide.summary, careDifficulty: definition.husbandryGuide.careDifficulty, fields: definition.husbandryGuide.fields } : null
  };
}

export async function buildEddyPageContext(userId: string, page: string) {
  const collection = await prisma.collection.findFirstOrThrow({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
  const [aquariums, openTasks, recentEvents, inventoryCount] = await Promise.all([
    prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, select: { name: true, generatedName: true, tankType: true, volumeGallons: true, status: true }, orderBy: { createdAt: "asc" } }),
    prisma.careTask.findMany({ where: { careSchedule: { collectionId: collection.id }, status: "PENDING" }, select: { title: true, dueAt: true, aquarium: { select: { name: true, generatedName: true } } }, orderBy: { dueAt: "asc" }, take: 12 }),
    prisma.aquariumEvent.findMany({ where: { collectionId: collection.id }, select: { title: true, eventType: true, eventDate: true, aquarium: { select: { name: true, generatedName: true } } }, orderBy: { eventDate: "desc" }, take: 8 }),
    prisma.aquariumItem.count({ where: { collectionId: collection.id, status: "ACTIVE" } })
  ]);
  return { kind: "page" as const, page, collection: collection.name, aquariums: aquariums.map((tank) => ({ name: tank.generatedName ?? tank.name, tankType: tank.tankType, volumeGallons: tank.volumeGallons, status: tank.status })), openTasks: openTasks.map((task) => ({ title: task.title, dueAt: task.dueAt, aquarium: task.aquarium?.generatedName ?? task.aquarium?.name })), recentEvents: recentEvents.map((event) => ({ title: event.title, type: event.eventType, date: event.eventDate, aquarium: event.aquarium.generatedName ?? event.aquarium.name })), inventoryCount };
}
