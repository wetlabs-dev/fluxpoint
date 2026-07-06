import { prisma } from "@/lib/db/prisma";
import { buildLocationPath } from "@/lib/format/location";
import { aquariumEquipmentRoleLabels } from "@/domains/aquariums/equipment-attachments";
import { formatLightLoad, calculateScheduleLightLoad } from "@/domains/lighting/light-load";
import { activeConditionStatuses } from "@/domains/conditions/condition-catalog";
import { groupAquariumInhabitants, type AquariumInhabitantGroup } from "@/domains/aquariums/inhabitant-groups";
import type { AquariumEquipmentRole, SpeciesCategory } from "@prisma/client";

export type TankSummaryMode = "compact" | "standard" | "detailed";
export type TankSummaryFormat = "plain" | "markdown";

const activeItemStatuses = ["ACTIVE", "IN_AQUARIUM"] as const;
const activeWorkflowStatuses = ["RUNNING", "ACTIVE", "PAUSED"] as const;
const activeEmergencyStatuses = ["ACTIVE", "STABILIZING", "RECOVERING", "VERIFYING"] as const;

export type TankSummaryData = {
  aquarium: {
    name: string;
    status: string;
    salinity: string;
    type: string;
    volume: string | null;
    location: string | null;
    dimensions: string | null;
    estimatedVolume: string | null;
    description: string | null;
    updatedAt: Date;
  };
  waterTargets: string[];
  inhabitants: Record<"fish" | "inverts" | "plants" | "corals" | "other", SummaryInhabitantGroup[]>;
  equipment: Record<string, string[]>;
  lighting: string[];
  conditions: string[];
  emergencies: string[];
  workflows: string[];
  care: string[];
  additionalContents: string[];
  missing: string[];
  generatedAt: Date;
};

export type CollectionTankSummaryData = {
  collection: {
    name: string;
    tankCount: number;
    totalVolumeGallons: number | null;
    totalFish: number;
    totalPlants: number;
    totalOpenConditions: number;
  };
  tanks: TankSummaryData[];
  generatedAt: Date;
};

type SummaryInhabitantGroup = {
  name: string;
  scientificName: string | null;
  quantity: number;
  unit: string | null;
  batchCount: number;
  status: string;
};

export async function buildTankSummaryData(aquariumId: string, collectionId: string): Promise<TankSummaryData> {
  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId },
    include: tankSummaryInclude()
  });
  return serializeTankSummary(aquarium);
}

export async function buildCollectionTankSummaryData(collectionId: string): Promise<CollectionTankSummaryData> {
  const collection = await prisma.collection.findFirstOrThrow({
    where: { id: collectionId },
    select: { name: true }
  });
  const aquariums = await prisma.aquarium.findMany({
    where: { collectionId },
    include: tankSummaryInclude(),
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });
  const tanks = aquariums.map(serializeTankSummary);
  const totalVolumeGallons = sumDefined(aquariums.map((aquarium) => aquarium.volumeGallons));
  return {
    collection: {
      name: collection.name,
      tankCount: tanks.length,
      totalVolumeGallons,
      totalFish: tanks.reduce((sum, tank) => sum + sumGroups(tank.inhabitants.fish), 0),
      totalPlants: tanks.reduce((sum, tank) => sum + sumGroups(tank.inhabitants.plants), 0),
      totalOpenConditions: tanks.reduce((sum, tank) => sum + tank.conditions.length, 0)
    },
    tanks,
    generatedAt: new Date()
  };
}

export function formatTankSummaryPlainText(data: TankSummaryData, mode: TankSummaryMode = "standard") {
  if (mode === "compact") return compactTankPlain(data);
  const lines = [
    `${data.aquarium.name}`,
    `${[label(data.aquarium.salinity), label(data.aquarium.type), label(data.aquarium.status), data.aquarium.volume, data.aquarium.location].filter(Boolean).join(" · ")}`,
    "",
    sectionPlain("Physical", [data.aquarium.dimensions ? `Dimensions: ${data.aquarium.dimensions}` : null, data.aquarium.estimatedVolume ? `Estimated volume: ${data.aquarium.estimatedVolume}` : null]),
    sectionPlain("Water targets", data.waterTargets),
    sectionPlain("Inhabitants", inhabitantLines(data, mode)),
    sectionPlain("Equipment", equipmentLines(data, mode)),
    sectionPlain("Lighting", data.lighting),
    sectionPlain("Conditions / alerts", [...data.conditions, ...data.emergencies, ...data.workflows, ...data.care]),
    sectionPlain("Unstructured notes", data.additionalContents),
    data.aquarium.description ? sectionPlain("Notes", [data.aquarium.description]) : "",
    sectionPlain("Missing / uncertain", data.missing),
    `Generated: ${dateStamp(data.generatedAt)}`
  ];
  return cleanText(lines.join("\n"));
}

export function formatTankSummaryMarkdown(data: TankSummaryData, mode: TankSummaryMode = "standard") {
  if (mode === "compact") return `## ${data.aquarium.name}\n\n${compactTankPlain(data)}\n`;
  const lines = [
    `## ${data.aquarium.name}`,
    "",
    `${[label(data.aquarium.salinity), label(data.aquarium.type), label(data.aquarium.status), data.aquarium.volume, data.aquarium.location].filter(Boolean).join(" · ")}`,
    "",
    sectionMarkdown("Physical", [data.aquarium.dimensions ? `Dimensions: ${data.aquarium.dimensions}` : null, data.aquarium.estimatedVolume ? `Estimated volume: ${data.aquarium.estimatedVolume}` : null]),
    sectionMarkdown("Water targets", data.waterTargets),
    sectionMarkdown("Inhabitants", inhabitantLines(data, mode)),
    sectionMarkdown("Equipment", equipmentLines(data, mode)),
    sectionMarkdown("Lighting", data.lighting),
    sectionMarkdown("Conditions / alerts", [...data.conditions, ...data.emergencies, ...data.workflows, ...data.care]),
    sectionMarkdown("Unstructured notes", data.additionalContents),
    data.aquarium.description ? sectionMarkdown("Notes", [data.aquarium.description]) : "",
    sectionMarkdown("Missing / uncertain", data.missing),
    `_Generated ${dateStamp(data.generatedAt)}_`
  ];
  return cleanText(lines.join("\n"));
}

export function formatCollectionSummaryPlainText(data: CollectionTankSummaryData, mode: TankSummaryMode = "compact") {
  const header = [
    `${data.collection.name} — Concise Tank Summary`,
    `${data.collection.tankCount} tank(s)${data.collection.totalVolumeGallons != null ? ` · ${formatNumber(data.collection.totalVolumeGallons)} total gal` : ""} · ${formatNumber(data.collection.totalFish)} fish · ${formatNumber(data.collection.totalPlants)} plants · ${data.collection.totalOpenConditions} open condition(s)`,
    `Generated: ${dateStamp(data.generatedAt)}`
  ].join("\n");
  const body = data.tanks.map((tank) => {
    if (mode === "compact") return compactTankPlain(tank);
    return formatTankSummaryPlainText(tank, mode);
  }).join("\n\n");
  return cleanText(`${header}\n\n${body}`);
}

export function formatCollectionSummaryMarkdown(data: CollectionTankSummaryData, mode: TankSummaryMode = "compact") {
  const header = [
    `# ${data.collection.name} — Concise Tank Summary`,
    "",
    `- Tanks: ${data.collection.tankCount}`,
    data.collection.totalVolumeGallons != null ? `- Total volume: ${formatNumber(data.collection.totalVolumeGallons)} gal` : null,
    `- Fish: ${formatNumber(data.collection.totalFish)}`,
    `- Plants: ${formatNumber(data.collection.totalPlants)}`,
    `- Open conditions: ${data.collection.totalOpenConditions}`,
    `- Generated: ${dateStamp(data.generatedAt)}`
  ].filter(Boolean).join("\n");
  const body = data.tanks.map((tank) => {
    if (mode === "compact") return `## ${tank.aquarium.name}\n\n${compactTankPlain(tank)}`;
    return formatTankSummaryMarkdown(tank, mode);
  }).join("\n\n");
  return cleanText(`${header}\n\n${body}`);
}

function tankSummaryInclude() {
  return {
    profile: true,
    waterSource: true,
    waterRecipe: { include: { waterSource: true, additives: { include: { inventoryItem: true }, orderBy: [{ sortOrder: "asc" as const }, { additiveName: "asc" as const }] } } },
    structuredLocation: { include: { parent: { include: { parent: true } } } },
    additionalContents: { where: { archivedAt: null, includeInEddyContext: true }, orderBy: [{ category: "asc" as const }, { createdAt: "asc" as const }] },
    equipmentAttachments: { include: { item: { include: { equipmentProfile: { include: { lightCapabilityProfile: true } }, aquariumAttachments: { include: { aquarium: { select: { id: true, name: true } } } } } } }, orderBy: [{ role: "asc" as const }, { sortOrder: "asc" as const }, { createdAt: "asc" as const }] },
    lightingAssignments: { include: { schedule: { include: { capabilityProfile: true, points: { orderBy: { sortOrder: "asc" as const } } } }, equipmentItem: { include: { equipmentProfile: { include: { lightCapabilityProfile: true } } } } } },
    items: { where: { status: { in: [...activeItemStatuses] } }, include: { speciesDefinition: true, speciesVariant: true, source: true }, orderBy: [{ itemType: "asc" as const }, { name: "asc" as const }] },
    healthConditions: { where: { status: { in: activeConditionStatuses } }, orderBy: [{ severity: "desc" as const }, { lastObservedAt: "desc" as const }] },
    workflowRuns: { where: { status: { in: [...activeWorkflowStatuses] } }, include: { workflowTemplate: true }, orderBy: { startedAt: "desc" as const } },
    careTasks: { where: { status: "PENDING" as const }, include: { careSchedule: true, emergencyIncidentStep: true }, orderBy: { dueAt: "asc" as const }, take: 8 },
    emergencyIncidentAquariums: { include: { incident: true }, where: { incident: { status: { in: [...activeEmergencyStatuses] } } }, orderBy: { createdAt: "desc" as const } }
  };
}

function serializeTankSummary(aquarium: any): TankSummaryData {
  const groups = groupAquariumInhabitants(aquarium.items ?? []);
  const inhabitants = {
    fish: summarizeGroups(groups.filter((group) => groupCategory(group) === "FISH")),
    inverts: summarizeGroups(groups.filter((group) => groupCategory(group) === "INVERT")),
    plants: summarizeGroups(groups.filter((group) => groupCategory(group) === "PLANT")),
    corals: summarizeGroups(groups.filter((group) => groupCategory(group) === "CORAL")),
    other: summarizeGroups(groups.filter((group) => groupCategory(group) === "OTHER"))
  };
  const equipment = groupEquipment(aquarium.equipmentAttachments ?? []);
  const lighting = (aquarium.lightingAssignments ?? [])
    .filter((assignment: any) => assignment.enabled && assignment.schedule)
    .map((assignment: any) => {
      const estimate = calculateScheduleLightLoad(assignment.schedule.points, assignment.schedule.capabilityProfile, assignment.equipmentItem?.equipmentProfile ?? null, assignment.schedule.rampMinutes);
      return `${assignment.equipmentItem?.name ?? "Light"}: ${assignment.schedule.name}${estimate.equivalentFullOutputHours != null ? ` · ${estimate.equivalentFullOutputHours.toFixed(2)} full-output h` : ""}${estimate.estimatedLumenHours != null ? ` · ${formatLightLoad(estimate.estimatedLumenHours)}` : ""}`;
    });
  return {
    aquarium: {
      name: aquarium.name,
      status: aquarium.status,
      salinity: aquarium.salinity,
      type: aquarium.aquariumType,
      volume: aquarium.volumeGallons != null ? `${formatNumber(aquarium.volumeGallons)} gal` : null,
      location: aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation) : aquarium.location,
      dimensions: [aquarium.lengthInches, aquarium.widthInches, aquarium.heightInches].every((value) => value != null) ? `${formatNumber(aquarium.lengthInches)} x ${formatNumber(aquarium.widthInches)} x ${formatNumber(aquarium.heightInches)} in` : null,
      estimatedVolume: estimatedVolume(aquarium),
      description: aquarium.description,
      updatedAt: aquarium.updatedAt
    },
    waterTargets: waterTargetLines(aquarium),
    inhabitants,
    equipment,
    lighting,
    conditions: (aquarium.healthConditions ?? []).map((condition: any) => `${condition.title} · ${label(condition.severity)} · ${label(condition.status)}`),
    emergencies: (aquarium.emergencyIncidentAquariums ?? []).map((link: any) => `${link.incident.title} · ${label(link.incident.severity)} · ${label(link.incident.status)}`),
    workflows: (aquarium.workflowRuns ?? []).map((run: any) => `${run.title || run.workflowTemplate?.name || "Workflow"} · ${label(run.status)}`),
    care: (aquarium.careTasks ?? []).map((task: any) => `${task.title}${task.dueAt ? ` · due ${dateStamp(task.dueAt)}` : ""}`),
    additionalContents: (aquarium.additionalContents ?? []).map((row: any) => `${label(row.category)}: ${[row.approximateQuantity, row.description].filter(Boolean).join(" ")}${row.confidence ? ` (${label(row.confidence)} confidence)` : ""}`),
    missing: missingLines(aquarium, inhabitants, equipment),
    generatedAt: new Date()
  };
}

function waterTargetLines(aquarium: any) {
  const profile = aquarium.profile ?? {};
  return [
    rangeLine("Salinity", aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt, "ppt"),
    rangeLine("Temperature", profile.targetTemperatureMin ?? profile.targetTemperature, profile.targetTemperatureMax ?? profile.targetTemperature, "°F"),
    rangeLine("pH", profile.targetPhMin ?? profile.targetPh, profile.targetPhMax ?? profile.targetPh, ""),
    rangeLine("GH", profile.targetGhMin ?? profile.targetGh, profile.targetGhMax ?? profile.targetGh, ""),
    rangeLine("KH", profile.targetKhMin ?? profile.targetKh, profile.targetKhMax ?? profile.targetKh, ""),
    aquarium.waterSource?.name ? `Water source: ${aquarium.waterSource.name}` : profile.waterSource ? `Water source: ${profile.waterSource}` : null,
    aquarium.waterRecipe?.name ? `Water recipe: ${aquarium.waterRecipe.name}` : null
  ].filter(Boolean) as string[];
}

function groupEquipment(attachments: any[]) {
  const groups: Record<string, string[]> = {};
  for (const attachment of attachments) {
    const role = attachment.role as AquariumEquipmentRole;
    const labelText = aquariumEquipmentRoleLabels[role] ?? label(role);
    const shared = (attachment.item?.aquariumAttachments ?? []).filter((row: any) => row.aquarium?.name).length > 1 ? " · shared" : "";
    const model = [attachment.item?.equipmentProfile?.brand, attachment.item?.equipmentProfile?.model].filter(Boolean).join(" ");
    const detail = [attachment.item?.name, model ? `(${model})` : null].filter(Boolean).join(" ");
    groups[labelText] = [...(groups[labelText] ?? []), `${detail}${shared}`];
  }
  return groups;
}

function inhabitantLines(data: TankSummaryData, mode: TankSummaryMode) {
  const entries = [
    ["Fish", data.inhabitants.fish],
    ["Invertebrates", data.inhabitants.inverts],
    ["Plants", data.inhabitants.plants],
    ["Corals", data.inhabitants.corals],
    ["Other", data.inhabitants.other]
  ] as const;
  return entries.flatMap(([title, groups]) => {
    if (!groups.length) return [];
    return [`${title}: ${groups.map((group) => formatGroup(group, mode)).join("; ")}`];
  });
}

function equipmentLines(data: TankSummaryData, mode: TankSummaryMode) {
  return Object.entries(data.equipment).map(([role, items]) => `${role}: ${mode === "detailed" ? items.join("; ") : items.slice(0, 4).join(", ")}${mode !== "detailed" && items.length > 4 ? `, +${items.length - 4} more` : ""}`);
}

function compactTankPlain(data: TankSummaryData) {
  const animalSummary = [
    data.inhabitants.fish.length ? `${formatNumber(sumGroups(data.inhabitants.fish))} fish` : null,
    data.inhabitants.inverts.length ? `${formatNumber(sumGroups(data.inhabitants.inverts))} inverts` : null,
    data.inhabitants.plants.length ? `${formatNumber(sumGroups(data.inhabitants.plants))} plants` : null,
    data.inhabitants.corals.length ? `${formatNumber(sumGroups(data.inhabitants.corals))} corals` : null,
    data.inhabitants.other.length ? `${formatNumber(sumGroups(data.inhabitants.other))} other` : null
  ].filter(Boolean).join(", ") || "No structured inhabitants";
  const equipmentSummary = Object.entries(data.equipment).slice(0, 4).map(([role, items]) => `${role}: ${items.length}`).join(" · ") || "No attached equipment";
  const alerts = [...data.conditions, ...data.emergencies, ...data.workflows].slice(0, 3).join(" · ") || "No active conditions, emergencies, or workflows";
  return `${data.aquarium.name}: ${[label(data.aquarium.salinity), label(data.aquarium.type), data.aquarium.volume, data.aquarium.location].filter(Boolean).join(" · ")}. ${animalSummary}. ${equipmentSummary}. ${data.waterTargets.slice(0, 4).join(" · ") || "Water targets incomplete"}. ${alerts}.`;
}

function sectionPlain(title: string, values: Array<string | null | undefined>) {
  const clean = values.filter(Boolean) as string[];
  if (!clean.length) return "";
  return `${title}:\n${clean.map((value) => `- ${value}`).join("\n")}\n`;
}

function sectionMarkdown(title: string, values: Array<string | null | undefined>) {
  const clean = values.filter(Boolean) as string[];
  if (!clean.length) return "";
  return `### ${title}\n\n${clean.map((value) => `- ${value}`).join("\n")}\n`;
}

function formatGroup(group: SummaryInhabitantGroup, mode: TankSummaryMode) {
  const scientific = group.scientificName ? ` (${group.scientificName})` : "";
  const batches = mode === "detailed" && group.batchCount > 1 ? ` across ${group.batchCount} batches` : "";
  return `${group.name}${scientific} — ${formatNumber(group.quantity)} ${group.unit ?? "units"}${batches}`;
}

function summarizeGroups(groups: AquariumInhabitantGroup[]): SummaryInhabitantGroup[] {
  return groups.map((group) => ({
    name: group.displayName,
    scientificName: group.scientificName,
    quantity: group.totalQuantity,
    unit: group.unit,
    batchCount: group.batchCount,
    status: group.status
  }));
}

function groupCategory(group: AquariumInhabitantGroup): SpeciesCategory | "OTHER" {
  const category = group.primaryItem.speciesDefinition?.category;
  if (category) return category as SpeciesCategory;
  if (["FISH", "INVERT", "PLANT"].includes(group.itemType)) return group.itemType as SpeciesCategory;
  return "OTHER";
}

function missingLines(aquarium: any, inhabitants: TankSummaryData["inhabitants"], equipment: Record<string, string[]>) {
  return [
    aquarium.volumeGallons == null ? "Volume is not recorded." : null,
    !aquarium.location && !aquarium.structuredLocation ? "Location is not recorded." : null,
    !aquarium.waterSource && !aquarium.profile?.waterSource ? "Water source is not recorded." : null,
    !Object.keys(equipment).length ? "No equipment is attached." : null,
    !Object.values(inhabitants).some((groups) => groups.length > 0) ? "No structured inhabitants are recorded." : null,
    !aquarium.profile?.targetTemperature && aquarium.profile?.targetTemperatureMin == null ? "Temperature target is missing." : null,
    !aquarium.profile?.targetPh && aquarium.profile?.targetPhMin == null ? "pH target is missing." : null
  ].filter(Boolean) as string[];
}

function rangeLine(labelText: string, min: number | null | undefined, max: number | null | undefined, unit: string) {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${labelText}: ${formatNumber(min)}–${formatNumber(max)}${unit ? ` ${unit}` : ""}`;
  return `${labelText}: ${formatNumber(min ?? max ?? 0)}${unit ? ` ${unit}` : ""}`;
}

function estimatedVolume(aquarium: any) {
  const values = [aquarium.lengthInches, aquarium.widthInches, aquarium.heightInches].map(Number);
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  return `${formatNumber(values[0] * values[1] * values[2] / 231)} gal`;
}

function sumDefined(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
}

function sumGroups(groups: SummaryInhabitantGroup[]) {
  return groups.reduce((sum, group) => sum + group.quantity, 0);
}

function label(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1).replace(/\.0$/, "");
}

function dateStamp(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function cleanText(value: string) {
  return value.replace(/\n{3,}/g, "\n\n").trimEnd();
}
