"use server";

import { createHash, randomBytes } from "crypto";
import { addDays, addMonths } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { appUrl, sendEmail } from "@/domains/email/email-service";
import { invitationEmail } from "@/domains/email/templates";
import { legacyPointValues, parseLightChannels, pointValuesFromForm } from "@/domains/lighting/capabilities";
import {
  deleteSpeciesHusbandryGuide,
  forkSpeciesHusbandryGuide,
  husbandryFormDataForGuide,
  linkSpeciesHusbandryGuide,
  saveSpeciesHusbandryGuide,
  saveSpeciesHusbandryGuideField,
  saveSpeciesHusbandryOverride,
  saveSpeciesHusbandryOverrideField
} from "@/domains/husbandry/husbandry-service";
import { inferSpeciesHusbandryType, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";
import { careRoles, collectionOwnerRoles, getCollectionRole, isServerAdmin, requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import type { CollectionRole, RegionalSpeciesStatus, RegionalStatusConfidence } from "@prisma/client";
import { aquariumEquipmentRoles, isAttachableAquariumItem } from "@/domains/aquariums/equipment-attachments";
import { speciesMatchesAquariumTarget } from "@/domains/species/habitat";
import { normalizeSpeciesAlias, speciesAliasRows } from "@/domains/species/aliases";
import { co2RequirementToPreference, normalizeCo2Requirement } from "@/domains/species/co2";
import { buildLocalityLabel, isConcerningRegionalStatus, isRestrictedRegionalStatus, regionalSpeciesStatuses } from "@/domains/species/regional-status";
import { ensureQrCode } from "@/domains/qr/qr-service";
import { setFormFlash } from "@/lib/forms/form-flash";
import { finishCreateFlow, wantsCreateAndAddAnother } from "@/lib/forms/create-flow";
import {
  defaultUnitForItemType,
  displayNameForSpecies,
  isBiologicalItemType,
  normalizeQuantityInput,
  speciesMatchesItemType
} from "@/domains/inventory/quantity";
import { fishSexCountsAfterQuantityChange, normalizeFishSexCounts } from "@/domains/inventory/fish-sex";
import { normalizeAuthorCitation } from "@/lib/format/species";
import { normalizeSpeciesBioloadClass } from "@/domains/species/bioload";
import { completeWorkflowStepRun, startWorkflowRun } from "@/domains/workflows/workflow-service";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : Number(value);
}

function positiveMaxLumens(formData: FormData) {
  const value = numberValue(formData, "maxLumens");
  if (value === null) return null;
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded) || rounded <= 0 || rounded >= 1_000_000) throw new Error("Max lumens must be between 1 and 999,999.");
  return rounded;
}

function positiveOptionalNumber(formData: FormData, key: string, label: string, maximum: number) {
  const value = numberValue(formData, key);
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0 || value > maximum) throw new Error(`${label} must be greater than zero and no more than ${maximum.toLocaleString()}.`);
  return value;
}

function lightOutputData(formData: FormData, equipmentType: string) {
  if (equipmentType !== "LIGHT") return { maxLumens: null, wattage: null, efficacyLumensPerWatt: null, outputEstimateMethod: "UNKNOWN" as const };
  const maxLumens = positiveMaxLumens(formData);
  const wattage = positiveOptionalNumber(formData, "wattage", "Wattage", 100_000);
  const efficacyLumensPerWatt = positiveOptionalNumber(formData, "efficacyLumensPerWatt", "Lumens per watt", 1_000);
  return { maxLumens, wattage, efficacyLumensPerWatt, outputEstimateMethod: maxLumens ? "LUMENS" as const : wattage ? "WATTAGE_ESTIMATED" as const : "UNKNOWN" as const };
}

function equipmentSharingData(formData: FormData) {
  return { multiAquariumCapable: checked(formData, "multiAquariumCapable") };
}

function rampMinutesFromForm(formData: FormData, key: string) {
  const value = numberValue(formData, key) ?? 0;
  return Number.isFinite(value) ? Math.min(1440, Math.max(0, Math.round(value))) : 0;
}

function scheduleRampMinutesFromForm(formData: FormData) {
  if (!formData.has("rampMinutes")) return 30;
  return rampMinutesFromForm(formData, "rampMinutes");
}

function decimalString(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : value;
}

function buildScientificNameFromForm(formData: FormData) {
  const base = [text(formData, "genus"), text(formData, "species")].filter(Boolean).join(" ");
  const variety = text(formData, "variety");
  const cultivar = text(formData, "cultivar");
  return [base || null, variety ? `var. ${variety}` : null, cultivar ? `'${cultivar}'` : null].filter(Boolean).join(" ") || null;
}

function optionalWebUrl(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a complete URL.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`${label} must use HTTP or HTTPS.`);
  return parsed.toString();
}

function speciesReferenceData(formData: FormData, category = String(formData.get("category") ?? "OTHER"), existing?: { powoUrl?: string | null }) {
  return {
    authorCitation: normalizeAuthorCitation(text(formData, "authorCitation")),
    wikipediaUrl: optionalWebUrl(formData, "wikipediaUrl", "Wikipedia URL"),
    inaturalistUrl: optionalWebUrl(formData, "inaturalistUrl", "iNaturalist URL"),
    powoUrl: category === "PLANT" ? optionalWebUrl(formData, "powoUrl", "POWO URL") : existing ? existing.powoUrl ?? null : null,
    gbifUrl: optionalWebUrl(formData, "gbifUrl", "GBIF URL")
  };
}

function speciesBioloadData(formData: FormData, category = String(formData.get("category") ?? "OTHER")) {
  return normalizeSpeciesBioloadClass(formData.get("bioloadClass"), category);
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : new Date(value);
}

function itemPlacementFromForm(formData: FormData) {
  const aquariumId = text(formData, "aquariumId");
  const storageLocationId = text(formData, "storageLocationId");
  const quarantineProjectId = text(formData, "quarantineProjectId");
  if (quarantineProjectId) return { aquariumId: null, storageLocationId: null, quarantineProjectId, status: "IN_QUARANTINE" };
  if (aquariumId) return { aquariumId, storageLocationId: null, quarantineProjectId: null, status: "IN_AQUARIUM" };
  if (storageLocationId) return { aquariumId: null, storageLocationId, quarantineProjectId: null, status: "IN_STORAGE" };
  return { aquariumId: null, storageLocationId: null, quarantineProjectId: null, status: "ACTIVE" };
}

function fishSexAuditSnapshot(item: { itemType: string; maleCountApprox?: number | null; femaleCountApprox?: number | null }) {
  if (item.itemType !== "FISH") return null;
  const snapshot = { maleCountApprox: item.maleCountApprox ?? null, femaleCountApprox: item.femaleCountApprox ?? null };
  return snapshot.maleCountApprox != null || snapshot.femaleCountApprox != null ? snapshot : null;
}

async function validateItemPlacement(collectionId: string, placement: ReturnType<typeof itemPlacementFromForm>) {
  if (placement.aquariumId) {
    await prisma.aquarium.findFirstOrThrow({ where: { id: placement.aquariumId, collectionId } });
  }
  if (placement.storageLocationId) {
    await prisma.location.findFirstOrThrow({ where: { id: placement.storageLocationId, collectionId } });
  }
  if (placement.quarantineProjectId) {
    await prisma.quarantineProject.findFirstOrThrow({ where: { id: placement.quarantineProjectId, collectionId } });
  }
}

async function validateSpeciesPlacement(collectionId: string, aquariumId: string | null, speciesDefinitionId: string | null) {
  if (!aquariumId || !speciesDefinitionId) return;
  const [aquarium, species] = await Promise.all([
    prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId }, select: { targetSalinityMinPpt: true, targetSalinityMaxPpt: true } }),
    prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId }, { collectionId: null }] }, select: { commonName: true, salinityMin: true, salinityMax: true } })
  ]);
  if (!speciesMatchesAquariumTarget(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt, species.salinityMin, species.salinityMax)) throw new Error(`${species.commonName} does not have a salinity range compatible with this aquarium.`);
}

async function speciesForItemType(collectionId: string, itemType: string, speciesDefinitionId: string | null, options: { tankInhabitant?: boolean } = {}) {
  if (!speciesDefinitionId) return null;
  const species = await prisma.speciesDefinition.findFirstOrThrow({
    where: { id: speciesDefinitionId, OR: [{ collectionId }, { collectionId: null }] },
    select: { id: true, commonName: true, scientificName: true, genus: true, species: true, category: true, salinityMin: true, salinityMax: true }
  });
  if (!options.tankInhabitant && !isBiologicalItemType(itemType)) return null;
  if (!speciesMatchesItemType(itemType, species.category, options)) throw new Error(`${species.commonName} is a ${species.category.toLowerCase()} species and cannot be linked to ${itemType.toLowerCase().replaceAll("_", " ")} inventory.`);
  return species;
}

async function speciesAndVariantForItemType(collectionId: string, itemType: string, speciesDefinitionId: string | null, speciesVariantId: string | null, options: { tankInhabitant?: boolean } = {}) {
  if (!speciesVariantId) {
    const species = await speciesForItemType(collectionId, itemType, speciesDefinitionId, options);
    return { species, speciesDefinitionId: species?.id ?? null, speciesVariantId: null };
  }
  const variant = await prisma.speciesVariant.findFirstOrThrow({
    where: { id: speciesVariantId, collectionId, archivedAt: null },
    include: { speciesDefinition: { select: { id: true, commonName: true, scientificName: true, genus: true, species: true, category: true, salinityMin: true, salinityMax: true } } }
  });
  const species = variant.speciesDefinition;
  if (speciesDefinitionId && speciesDefinitionId !== species.id) throw new Error(`${variant.displayName ?? variant.name} belongs to ${species.commonName}; update the species definition selection first.`);
  if (!options.tankInhabitant && !isBiologicalItemType(itemType)) return { species: null, speciesDefinitionId: null, speciesVariantId: null };
  if (!speciesMatchesItemType(itemType, species.category, options)) throw new Error(`${species.commonName} is a ${species.category.toLowerCase()} species and cannot be linked to ${itemType.toLowerCase().replaceAll("_", " ")} inventory.`);
  return { species, speciesDefinitionId: species.id, speciesVariantId: variant.id };
}

async function validateRegionalSpeciesHandling(input: { collectionId: string; userId: string; speciesDefinitionId: string | null; formData: FormData }) {
  if (!input.speciesDefinitionId) return null;
  const regional = await prisma.speciesRegionalStatus.findUnique({ where: { collectionId_speciesDefinitionId: { collectionId: input.collectionId, speciesDefinitionId: input.speciesDefinitionId } } });
  if (!regional || !isConcerningRegionalStatus(regional.status)) return regional;
  if (isRestrictedRegionalStatus(regional.status)) {
    const [role, serverAdmin] = await Promise.all([getCollectionRole(input.userId, input.collectionId), isServerAdmin(input.userId)]);
    if (role !== "COLLECTION_OWNER" && !serverAdmin) throw new Error(`Only a Collection Owner or Server Admin can confirm handling a species marked ${regional.status.toLowerCase()}.`);
    if (input.formData.get("regionalStatusConfirmed") !== "on") throw new Error(`Confirm the ${regional.status.toLowerCase()} regional-status warning before continuing.`);
  }
  return regional;
}

async function auditRegionalSpeciesHandling(input: { collectionId: string; userId: string; speciesDefinitionId: string | null; entityType: string; entityId: string; regional: Awaited<ReturnType<typeof validateRegionalSpeciesHandling>>; workflow: string }) {
  if (!input.regional || !isConcerningRegionalStatus(input.regional.status)) return;
  await writeAuditLog({ collectionId: input.collectionId, entityType: input.entityType, entityId: input.entityId, action: isRestrictedRegionalStatus(input.regional.status) ? "REGIONAL_RESTRICTION_OVERRIDE_CONFIRMED" : "SPECIES_ADDED_DESPITE_REGIONAL_CONCERN", after: { workflow: input.workflow, speciesDefinitionId: input.speciesDefinitionId, status: input.regional.status, locality: input.regional.localityLabelSnapshot }, createdById: input.userId, severity: "WARNING" });
}

function nextDueDate(from: Date, cadenceType: string, intervalDays?: number | null, dayOfMonth?: number | null) {
  if (cadenceType === "DAILY") return addDays(from, 1);
  if (cadenceType === "WEEKLY") return addDays(from, 7);
  if (cadenceType === "MONTHLY") {
    const next = addMonths(from, 1);
    if (dayOfMonth) next.setDate(Math.min(dayOfMonth, 28));
    return next;
  }
  if (cadenceType === "EVERY_N_DAYS") return addDays(from, Math.max(intervalDays ?? 1, 1));
  return null;
}

function taskTitle(schedule: { name: string; scheduleType: string }) {
  return `${schedule.name}${schedule.scheduleType === "FEEDING" ? " feeding" : ""}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createPendingTaskForSchedule(schedule: {
  id: string;
  aquariumId: string | null;
  name: string;
  description: string | null;
  scheduleType: string;
  nextDueAt: Date | null;
}) {
  if (!schedule.nextDueAt) return null;
  return prisma.careTask.create({
    data: {
      careScheduleId: schedule.id,
      aquariumId: schedule.aquariumId,
      title: taskTitle(schedule),
      description: schedule.description,
      dueAt: schedule.nextDueAt
    }
  });
}

async function getCollection(allowedRoles: CollectionRole[] = structuralRoles) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, allowedRoles);
  return { user, collection };
}

export async function updateCollectionLocality(formData: FormData) {
  const { user, collection } = await getCollection(collectionOwnerRoles);
  const localityCountry = text(formData, "localityCountry")?.toUpperCase() ?? null;
  if (localityCountry && !/^[A-Z]{2}$/.test(localityCountry)) throw new Error("Country must use a two-letter ISO country code, such as US, GB, AU, or CA.");
  const data = {
    localityCity: text(formData, "localityCity"), localityRegion: text(formData, "localityRegion"), localityCountry,
    localityPostalCode: text(formData, "localityPostalCode"), localityNotes: text(formData, "localityNotes"),
    localityLabel: text(formData, "localityLabel") || buildLocalityLabel({ localityCity: text(formData, "localityCity"), localityRegion: text(formData, "localityRegion"), localityCountry })
  };
  await prisma.collection.update({ where: { id: collection.id }, data });
  await writeAuditLog({ collectionId: collection.id, entityType: "Collection", entityId: collection.id, action: "COLLECTION_LOCALITY_CHANGED", before: { localityCity: collection.localityCity, localityRegion: collection.localityRegion, localityCountry: collection.localityCountry, localityPostalCode: collection.localityPostalCode, localityLabel: collection.localityLabel, localityNotes: collection.localityNotes }, after: data, createdById: user.id });
  revalidatePath("/collection"); revalidatePath("/species");
  await setFormFlash("Collection locality saved.");
}

export async function createSpecies(formData: FormData) {
  const { user, collection } = await getCollection();
  regionalSourceUrl(formData);
  const aliases = speciesAliasRows(formData);
  const category = String(formData.get("category") ?? "OTHER");
  const co2Requirement = category === "PLANT" ? normalizeCo2Requirement(formData.get("co2Requirement")) : "UNKNOWN";
  const species = await prisma.speciesDefinition.create({
    data: {
      collectionId: collection.id,
      category: category as never,
      commonName: text(formData, "commonName") ?? "Unnamed species",
      scientificName: buildScientificNameFromForm(formData),
      genus: text(formData, "genus"),
      species: text(formData, "species"),
      variety: text(formData, "variety"),
      cultivar: text(formData, "cultivar"),
      ...speciesReferenceData(formData, category),
      careNotes: text(formData, "careNotes"),
      lifespan: text(formData, "lifespan"),
      minimumGroupSize: numberValue(formData, "minimumGroupSize"),
      maxSize: category === "FISH" ? text(formData, "maxSize") : null,
      bioloadClass: speciesBioloadData(formData, category) as never,
      maxHeight: numberValue(formData, "maxHeight"),
      maxSpread: numberValue(formData, "maxSpread"),
      growthRate: text(formData, "growthRate"),
      lightRequirement: text(formData, "lightRequirement"),
      co2Preference: text(formData, "co2Preference"),
      co2Requirement,
      preferredHardness: text(formData, "preferredHardness"),
      breedingNotes: text(formData, "breedingNotes"),
      flowRequirement: text(formData, "flowRequirement"),
      tempMin: numberValue(formData, "tempMin"),
      tempMax: numberValue(formData, "tempMax"),
      phMin: numberValue(formData, "phMin"),
      phMax: numberValue(formData, "phMax"),
      ghMin: numberValue(formData, "ghMin"),
      ghMax: numberValue(formData, "ghMax"),
      khMin: numberValue(formData, "khMin"),
      khMax: numberValue(formData, "khMax"),
      tdsMin: numberValue(formData, "tdsMin"),
      tdsMax: numberValue(formData, "tdsMax"),
      salinityMin: numberValue(formData, "salinityMin"),
      salinityMax: numberValue(formData, "salinityMax"),
      notes: text(formData, "notes"),
      aliases: aliases.length ? { create: aliases.map((row) => ({ collectionId: collection.id, ...row, normalizedAlias: normalizeSpeciesAlias(row.alias) })) } : undefined
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesDefinition", entityId: species.id, action: "CREATE", after: species, createdById: user.id });
  if (aliases.length) await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesAlias", entityId: species.id, action: "SPECIES_ALIASES_ADDED", after: aliases, createdById: user.id });
  await saveSpeciesRegionalStatus(formData, { userId: user.id, collection, speciesDefinitionId: species.id });
  await recordSpeciesMagicFillApplied(formData, { userId: user.id, collectionId: collection.id, speciesDefinitionId: species.id });
  revalidatePath("/species");
  await finishCreateFlow(formData, { detailUrl: `/species/${species.id}`, addAnotherUrl: "/species?create=1", createdMessage: `Created species: ${species.commonName}.`, addAnotherMessage: `Created species: ${species.commonName}. Ready for another.` });
}

export async function updateSpecies(formData: FormData) {
  const { user, collection } = await getCollection();
  regionalSourceUrl(formData);
  const id = String(formData.get("id"));
  const before = await prisma.speciesDefinition.findFirstOrThrow({ where: { id, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  if (before.collectionId === null && !(await isServerAdmin(user.id))) throw new Error("Only a server administrator can edit a shared species definition.");
  const aliases = speciesAliasRows(formData);
  const category = String(formData.get("category") ?? "OTHER");
  const co2Requirement = category === "PLANT" ? normalizeCo2Requirement(formData.get("co2Requirement")) : "UNKNOWN";
  const beforeAliases = await prisma.speciesAlias.findMany({ where: { speciesDefinitionId: id, collectionId: collection.id }, orderBy: [{ aliasType: "asc" }, { alias: "asc" }] });
  const species = await prisma.speciesDefinition.update({
    where: { id },
    data: {
      category: category as never,
      commonName: text(formData, "commonName") ?? "Unnamed species",
      scientificName: buildScientificNameFromForm(formData),
      genus: text(formData, "genus"),
      species: text(formData, "species"),
      variety: text(formData, "variety"),
      cultivar: text(formData, "cultivar"),
      ...speciesReferenceData(formData, category, before),
      careNotes: text(formData, "careNotes"),
      lifespan: text(formData, "lifespan"),
      minimumGroupSize: numberValue(formData, "minimumGroupSize"),
      maxSize: category === "FISH" ? text(formData, "maxSize") : before.maxSize,
      bioloadClass: speciesBioloadData(formData, category) as never,
      maxHeight: numberValue(formData, "maxHeight"),
      maxSpread: numberValue(formData, "maxSpread"),
      growthRate: text(formData, "growthRate"),
      lightRequirement: text(formData, "lightRequirement"),
      co2Preference: text(formData, "co2Preference"),
      co2Requirement,
      preferredHardness: text(formData, "preferredHardness"),
      breedingNotes: text(formData, "breedingNotes"),
      flowRequirement: text(formData, "flowRequirement"),
      tempMin: numberValue(formData, "tempMin"),
      tempMax: numberValue(formData, "tempMax"),
      phMin: numberValue(formData, "phMin"),
      phMax: numberValue(formData, "phMax"),
      ghMin: numberValue(formData, "ghMin"),
      ghMax: numberValue(formData, "ghMax"),
      khMin: numberValue(formData, "khMin"),
      khMax: numberValue(formData, "khMax"),
      tdsMin: numberValue(formData, "tdsMin"),
      tdsMax: numberValue(formData, "tdsMax"),
      salinityMin: numberValue(formData, "salinityMin"),
      salinityMax: numberValue(formData, "salinityMax"),
      notes: text(formData, "notes"),
      aliases: {
        deleteMany: { collectionId: collection.id },
        create: aliases.map((row) => ({ collectionId: collection.id, ...row, normalizedAlias: normalizeSpeciesAlias(row.alias) }))
      }
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesDefinition", entityId: species.id, action: "UPDATE", before, after: species, createdById: user.id });
  if (JSON.stringify(beforeAliases.map(({ alias, aliasType, notes, source }) => ({ alias, aliasType, notes, source }))) !== JSON.stringify(aliases)) {
    const beforeKeys = new Set(beforeAliases.map((row) => normalizeSpeciesAlias(row.alias)));
    const afterKeys = new Set(aliases.map((row) => normalizeSpeciesAlias(row.alias)));
    await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesAlias", entityId: species.id, action: "SPECIES_ALIASES_UPDATED", before: beforeAliases, after: aliases, metadata: { added: [...afterKeys].filter((key) => !beforeKeys.has(key)).length, removed: [...beforeKeys].filter((key) => !afterKeys.has(key)).length }, createdById: user.id });
  }
  await saveSpeciesRegionalStatus(formData, { userId: user.id, collection, speciesDefinitionId: species.id });
  await recordSpeciesMagicFillApplied(formData, { userId: user.id, collectionId: collection.id, speciesDefinitionId: species.id });
  revalidatePath("/species");
  revalidatePath(`/species/${id}`);
  await setFormFlash(`Saved species: ${species.commonName}.`);
}

function regionalSourceUrl(formData: FormData) {
  const sourceUrl = text(formData, "regionalSourceUrl");
  if (sourceUrl) {
    const parsed = new URL(sourceUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Regional status source URL must use HTTP or HTTPS.");
  }
  return sourceUrl;
}

async function saveSpeciesRegionalStatus(formData: FormData, input: { userId: string; collection: Awaited<ReturnType<typeof getUserCollection>>; speciesDefinitionId: string }) {
  const proposed = String(formData.get("regionalStatus") || "UNKNOWN");
  const status: RegionalSpeciesStatus = regionalSpeciesStatuses.includes(proposed as RegionalSpeciesStatus) ? proposed as RegionalSpeciesStatus : "UNKNOWN";
  const confidenceValue = text(formData, "regionalConfidence");
  const confidence: RegionalStatusConfidence | null = confidenceValue && ["LOW", "MEDIUM", "HIGH"].includes(confidenceValue) ? confidenceValue as RegionalStatusConfidence : null;
  const sourceUrl = regionalSourceUrl(formData);
  const data = {
    localityCitySnapshot: input.collection.localityCity, localityRegionSnapshot: input.collection.localityRegion,
    localityCountrySnapshot: input.collection.localityCountry, localityPostalCodeSnapshot: input.collection.localityPostalCode,
    localityLabelSnapshot: input.collection.localityLabel || buildLocalityLabel(input.collection), status,
    statusScope: text(formData, "regionalStatusScope"), sourceName: text(formData, "regionalSourceName"), sourceUrl,
    notes: text(formData, "regionalNotes"), confidence, checkedAt: new Date(), checkedByUserId: input.userId
  };
  const before = await prisma.speciesRegionalStatus.findUnique({ where: { collectionId_speciesDefinitionId: { collectionId: input.collection.id, speciesDefinitionId: input.speciesDefinitionId } } });
  const saved = await prisma.speciesRegionalStatus.upsert({ where: { collectionId_speciesDefinitionId: { collectionId: input.collection.id, speciesDefinitionId: input.speciesDefinitionId } }, update: data, create: { collectionId: input.collection.id, speciesDefinitionId: input.speciesDefinitionId, ...data } });
  await writeAuditLog({ collectionId: input.collection.id, entityType: "SpeciesRegionalStatus", entityId: saved.id, action: before ? "REGIONAL_STATUS_UPDATED" : "REGIONAL_STATUS_CREATED", before, after: saved, createdById: input.userId });
  if (text(formData, "magicFillRequestLogId")) await writeAuditLog({ collectionId: input.collection.id, entityType: "SpeciesRegionalStatus", entityId: saved.id, action: "EDDY_REGIONAL_STATUS_APPLIED", after: { status: saved.status, speciesDefinitionId: input.speciesDefinitionId }, createdById: input.userId });
  return saved;
}

export async function saveSpeciesRegionalStatusAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId: collection.id }, { collectionId: null }] }, select: { id: true } });
  await saveSpeciesRegionalStatus(formData, { userId: user.id, collection, speciesDefinitionId });
  revalidatePath("/species"); revalidatePath(`/species/${speciesDefinitionId}`);
  await setFormFlash("Regional status saved.");
}

export async function deleteSpeciesRegionalStatus(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const before = await prisma.speciesRegionalStatus.findUnique({ where: { collectionId_speciesDefinitionId: { collectionId: collection.id, speciesDefinitionId } } });
  if (!before) return;
  await prisma.speciesRegionalStatus.delete({ where: { id: before.id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesRegionalStatus", entityId: before.id, action: "REGIONAL_STATUS_DELETED", before, createdById: user.id });
  revalidatePath("/species"); revalidatePath(`/species/${speciesDefinitionId}`);
  await setFormFlash("Regional status removed.");
}

async function recordSpeciesMagicFillApplied(formData: FormData, input: { userId: string; collectionId: string; speciesDefinitionId: string }) {
  const requestLogId = text(formData, "magicFillRequestLogId");
  if (!requestLogId) return;
  const log = await prisma.aiRequestLog.findFirst({ where: { id: requestLogId, userId: input.userId, collectionId: input.collectionId, featureKey: "SPECIES_MAGIC_FILL", status: "SUCCEEDED" }, select: { id: true, output: true } });
  if (!log) return;
  const draft = (log.output && typeof log.output === "object" ? log.output : {}) as { salinityMinPpt?: number | null; salinityMaxPpt?: number | null; aliases?: unknown[]; references?: Record<string, string | null>; canonical?: { genus?: string | null; species?: string | null }; profile?: { maxSize?: string | null; co2Requirement?: string | null; tdsMin?: number | null; tdsMax?: number | null } };
  await writeAuditLog({ collectionId: input.collectionId, entityType: "SpeciesDefinition", entityId: input.speciesDefinitionId, action: "EDDY_SPECIES_MAGIC_FILL_APPLIED", after: { requestLogId, canonical: draft.canonical ?? null, genusOnlySp: draft.canonical?.species === "sp.", maxSize: draft.profile?.maxSize ?? null, co2Requirement: draft.profile?.co2Requirement ?? null, tdsMin: draft.profile?.tdsMin ?? null, tdsMax: draft.profile?.tdsMax ?? null, salinityMinPpt: draft.salinityMinPpt ?? null, salinityMaxPpt: draft.salinityMaxPpt ?? null, aliasesAdded: draft.aliases?.length ?? 0, references: draft.references ?? null }, createdById: input.userId });
  if (draft.profile?.maxSize) await writeAuditLog({ collectionId: input.collectionId, entityType: "SpeciesDefinition", entityId: input.speciesDefinitionId, action: "EDDY_MAGIC_FILL_MAX_SIZE_APPLIED", after: { requestLogId, maxSize: draft.profile.maxSize }, createdById: input.userId });
  if (draft.canonical?.species === "sp.") await writeAuditLog({ collectionId: input.collectionId, entityType: "SpeciesDefinition", entityId: input.speciesDefinitionId, action: "EDDY_MAGIC_FILL_GENUS_ONLY_APPLIED", after: { requestLogId, genus: draft.canonical.genus, species: "sp." }, createdById: input.userId });
  if (draft.references && Object.values(draft.references).some(Boolean)) await writeAuditLog({ collectionId: input.collectionId, entityType: "SpeciesDefinition", entityId: input.speciesDefinitionId, action: "EDDY_MAGIC_FILL_REFERENCES_APPLIED", after: { requestLogId, references: draft.references }, createdById: input.userId });
  if (draft.profile?.co2Requirement && draft.profile.co2Requirement !== "UNKNOWN") await writeAuditLog({ collectionId: input.collectionId, entityType: "SpeciesDefinition", entityId: input.speciesDefinitionId, action: "EDDY_MAGIC_FILL_CO2_REQUIREMENT_APPLIED", after: { requestLogId, co2Requirement: draft.profile.co2Requirement }, createdById: input.userId });
  if (draft.salinityMinPpt != null || draft.salinityMaxPpt != null) await writeAuditLog({ collectionId: input.collectionId, entityType: "SpeciesDefinition", entityId: input.speciesDefinitionId, action: "EDDY_MAGIC_FILL_SALINITY_APPLIED", after: { requestLogId, salinityMinPpt: draft.salinityMinPpt ?? null, salinityMaxPpt: draft.salinityMaxPpt ?? null }, createdById: input.userId });
  if (draft.profile?.tdsMin != null || draft.profile?.tdsMax != null) await writeAuditLog({ collectionId: input.collectionId, entityType: "SpeciesDefinition", entityId: input.speciesDefinitionId, action: "EDDY_MAGIC_FILL_TDS_APPLIED", after: { requestLogId, tdsMin: draft.profile?.tdsMin ?? null, tdsMax: draft.profile?.tdsMax ?? null }, createdById: input.userId });
  if (draft.aliases?.length) await writeAuditLog({ collectionId: input.collectionId, entityType: "SpeciesAlias", entityId: input.speciesDefinitionId, action: "EDDY_MAGIC_FILL_ALIASES_APPLIED", after: { requestLogId, aliases: draft.aliases }, createdById: input.userId });
}

export async function deleteSpecies(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.speciesDefinition.findFirstOrThrow({ where: { id, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  if (before.collectionId === null && !(await isServerAdmin(user.id))) throw new Error("Only a server administrator can delete a shared species definition.");
  const used = await prisma.aquariumItem.count({ where: { speciesDefinitionId: id } });
  if (used > 0) throw new Error("This species cannot be deleted while inventory items reference it.");
  await prisma.speciesDefinition.delete({ where: { id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesDefinition", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/species");
  await setFormFlash("Species deleted.");
}

export async function saveSpeciesHusbandryGuideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const definition = await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  const speciesType = String(formData.get("speciesType") || inferSpeciesHusbandryType(definition)) as HusbandrySpeciesType;
  const guide = await saveSpeciesHusbandryGuide({
    collectionId: collection.id,
    speciesDefinitionId,
    speciesType,
    summary: text(formData, "summary"),
    careDifficulty: text(formData, "careDifficulty"),
    sourceNotes: text(formData, "sourceNotes"),
    status: String(formData.get("status") || "LOCAL") as never,
    fields: husbandryFormDataForGuide(speciesType, formData)
  });
  if (speciesType === "PLANT") {
    const co2Requirement = normalizeCo2Requirement((guide.fields as Record<string, unknown>).co2Requirement);
    await prisma.speciesDefinition.update({
      where: { id: speciesDefinitionId },
      data: {
        co2Requirement,
        co2Preference: co2RequirementToPreference(co2Requirement) ?? undefined
      }
    });
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "UPDATE", after: guide, createdById: user.id });
  const magicFillRequestLogId = text(formData, "husbandryMagicFillRequestLogId");
  if (magicFillRequestLogId) await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "EDDY_HUSBANDRY_MAGIC_FILL_APPLIED", after: { requestLogId: magicFillRequestLogId, speciesDefinitionId, speciesType, fieldsFilled: Object.values(guide.fields as Record<string, unknown>).filter(Boolean).length }, createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function saveSpeciesHusbandryGuideFieldAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const fieldName = String(formData.get("fieldName"));
  const guide = await saveSpeciesHusbandryGuideField({
    collectionId: collection.id,
    speciesDefinitionId,
    fieldName,
    fieldValue: text(formData, "fieldValue")
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "UPDATE_FIELD", after: { fieldName }, createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function linkSpeciesHusbandryGuideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const sourceSpeciesDefinitionId = String(formData.get("sourceSpeciesDefinitionId"));
  const guide = await linkSpeciesHusbandryGuide(collection.id, speciesDefinitionId, sourceSpeciesDefinitionId, text(formData, "sourceNotes"));
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "LINK", after: guide, createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function forkSpeciesHusbandryGuideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const guide = await forkSpeciesHusbandryGuide(collection.id, speciesDefinitionId);
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "FORK", after: guide, createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function deleteSpeciesHusbandryGuideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  await deleteSpeciesHusbandryGuide(collection.id, speciesDefinitionId);
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesHusbandryGuide", entityId: speciesDefinitionId, action: "DELETE", createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function saveSpeciesHusbandryOverrideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumItemId = String(formData.get("aquariumItemId"));
  const speciesType = String(formData.get("speciesType") || "OTHER") as HusbandrySpeciesType;
  const override = await saveSpeciesHusbandryOverride({
    collectionId: collection.id,
    aquariumItemId,
    fields: husbandryFormDataForGuide(speciesType, formData),
    overrideNotes: text(formData, "overrideNotes")
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesHusbandryOverride", entityId: override?.id ?? aquariumItemId, action: override ? "UPDATE" : "DELETE", after: override, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/aquariums");
}

export async function saveSpeciesHusbandryOverrideFieldAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumItemId = String(formData.get("aquariumItemId"));
  const fieldName = String(formData.get("fieldName"));
  const override = await saveSpeciesHusbandryOverrideField({
    collectionId: collection.id,
    aquariumItemId,
    fieldName,
    fieldValue: text(formData, "fieldValue")
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "SpeciesHusbandryOverride", entityId: override?.id ?? aquariumItemId, action: "UPDATE_FIELD", after: { fieldName }, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/aquariums");
}

export async function createItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemType = String(formData.get("itemType") ?? "OTHER");
  const placement = itemPlacementFromForm(formData);
  await validateItemPlacement(collection.id, placement);
  const unit = text(formData, "unit");
  const { species, speciesDefinitionId, speciesVariantId } = await speciesAndVariantForItemType(collection.id, itemType, text(formData, "speciesDefinitionId"), text(formData, "speciesVariantId"));
  await validateSpeciesPlacement(collection.id, placement.aquariumId, speciesDefinitionId);
  const regional = await validateRegionalSpeciesHandling({ collectionId: collection.id, userId: user.id, speciesDefinitionId, formData });
  const name = text(formData, "name") ?? displayNameForSpecies(species) ?? "Unnamed item";
  const quantity = normalizeQuantityInput(formData.get("quantity"), itemType, unit, 1);
  const fishSexCounts = normalizeFishSexCounts({ itemType, quantity, maleCountApprox: formData.get("maleCountApprox"), femaleCountApprox: formData.get("femaleCountApprox") });
  const item = await prisma.aquariumItem.create({
    data: {
      collectionId: collection.id,
      itemType: itemType as never,
      aquariumId: placement.aquariumId,
      storageLocationId: placement.storageLocationId,
      quarantineProjectId: placement.quarantineProjectId,
      speciesDefinitionId,
      speciesVariantId,
      sourceId: text(formData, "sourceId"),
      name,
      description: text(formData, "description"),
      quantity,
      ...fishSexCounts,
      unit,
      status: String(formData.get("status") ?? placement.status) as never,
      purchasePrice: decimalString(formData, "purchasePrice"),
      acquiredAt: dateValue(formData, "acquiredAt"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: item.id, action: "CREATE", after: item, createdById: user.id });
  if (fishSexAuditSnapshot(item)) await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: item.id, action: "FISH_SEX_BREAKDOWN_SET", after: fishSexAuditSnapshot(item), createdById: user.id });
  await auditRegionalSpeciesHandling({ collectionId: collection.id, userId: user.id, speciesDefinitionId, entityType: "AquariumItem", entityId: item.id, regional, workflow: "create inventory item" });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  await finishCreateFlow(formData, { detailUrl: `/inventory/${item.id}`, addAnotherUrl: "/inventory?create=1", createdMessage: `Created item: ${item.name}.`, addAnotherMessage: `Created item: ${item.name}. Ready for another.` });
}

export async function updateItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.aquariumItem.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const placement = itemPlacementFromForm(formData);
  await validateItemPlacement(collection.id, placement);
  const itemType = String(formData.get("itemType") ?? before.itemType);
  const unit = text(formData, "unit");
  const { species, speciesDefinitionId, speciesVariantId } = await speciesAndVariantForItemType(collection.id, itemType, text(formData, "speciesDefinitionId"), text(formData, "speciesVariantId"));
  await validateSpeciesPlacement(collection.id, placement.aquariumId, speciesDefinitionId);
  const regional = await validateRegionalSpeciesHandling({ collectionId: collection.id, userId: user.id, speciesDefinitionId, formData });
  const name = text(formData, "name") ?? displayNameForSpecies(species) ?? before.name;
  const quantity = normalizeQuantityInput(formData.get("quantity"), itemType, unit, before.quantity);
  const fishSexCounts = normalizeFishSexCounts({ itemType, quantity, maleCountApprox: formData.get("maleCountApprox"), femaleCountApprox: formData.get("femaleCountApprox") });
  const item = await prisma.aquariumItem.update({
    where: { id },
    data: {
      itemType: itemType as never,
      aquariumId: placement.aquariumId,
      storageLocationId: placement.storageLocationId,
      quarantineProjectId: placement.quarantineProjectId,
      speciesDefinitionId,
      speciesVariantId,
      sourceId: text(formData, "sourceId"),
      name,
      description: text(formData, "description"),
      quantity,
      ...fishSexCounts,
      unit,
      status: String(formData.get("status") ?? before.status) as never,
      purchasePrice: decimalString(formData, "purchasePrice"),
      acquiredAt: dateValue(formData, "acquiredAt"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: id, action: "UPDATE", before, after: item, createdById: user.id });
  if (JSON.stringify(fishSexAuditSnapshot(before)) !== JSON.stringify(fishSexAuditSnapshot(item))) await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: id, action: "FISH_SEX_BREAKDOWN_UPDATED", before: fishSexAuditSnapshot(before), after: fishSexAuditSnapshot(item), createdById: user.id });
  await auditRegionalSpeciesHandling({ collectionId: collection.id, userId: user.id, speciesDefinitionId, entityType: "AquariumItem", entityId: id, regional, workflow: "update inventory item" });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  await setFormFlash(`Saved item: ${item.name}.`);
}

export async function archiveItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.aquariumItem.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const item = await prisma.aquariumItem.update({ where: { id }, data: { status: "ARCHIVED" } });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: id, action: "ARCHIVE", before, after: item, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/equipment");
  revalidatePath("/dashboard");
  await setFormFlash("Item archived.");
}

export async function transferItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const destinationType = String(formData.get("destinationType") ?? "AQUARIUM");
  const toAquariumId = text(formData, "toAquariumId");
  const toStorageLocationId = text(formData, "toStorageLocationId");
  const toQuarantineProjectId = text(formData, "toQuarantineProjectId");
  const reason = text(formData, "reason");
  const notes = text(formData, "notes");
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id } });
  const quantity = normalizeQuantityInput(formData.get("quantity"), item.itemType, item.unit, 1);
  if (quantity <= 0) throw new Error("Transfer quantity must be greater than zero.");
  const regional = await validateRegionalSpeciesHandling({ collectionId: collection.id, userId: user.id, speciesDefinitionId: item.speciesDefinitionId, formData });
  if (quantity > item.quantity) throw new Error("Transfer quantity cannot exceed the available quantity.");
  if (destinationType === "AQUARIUM" && !toAquariumId) throw new Error("Choose a destination aquarium.");
  if (destinationType === "STORAGE" && !toStorageLocationId) throw new Error("Choose a destination storage location.");
  if (destinationType === "QUARANTINE" && !toQuarantineProjectId) throw new Error("Choose a destination quarantine project.");
  if (destinationType === "AQUARIUM") {
    await prisma.aquarium.findFirstOrThrow({ where: { id: toAquariumId!, collectionId: collection.id } });
    await validateSpeciesPlacement(collection.id, toAquariumId, item.speciesDefinitionId);
  }
  if (destinationType === "STORAGE") {
    await prisma.location.findFirstOrThrow({ where: { id: toStorageLocationId!, collectionId: collection.id } });
  }
  if (destinationType === "QUARANTINE") {
    await prisma.quarantineProject.findFirstOrThrow({ where: { id: toQuarantineProjectId!, collectionId: collection.id } });
  }
  const fullTransfer = quantity >= item.quantity;
  const sourceSexAfterPartial = fullTransfer ? fishSexAuditSnapshot(item) : fishSexAuditSnapshot({ ...item, ...fishSexCountsAfterQuantityChange({ itemType: item.itemType, quantity: item.quantity - quantity, maleCountApprox: item.maleCountApprox, femaleCountApprox: item.femaleCountApprox }) });
  const destinationStatus = destinationType === "AQUARIUM"
    ? "IN_AQUARIUM"
    : destinationType === "STORAGE"
      ? "IN_STORAGE"
      : destinationType === "QUARANTINE"
        ? "IN_QUARANTINE"
        : destinationType;
  const destination = {
    aquariumId: destinationType === "AQUARIUM" ? toAquariumId : null,
    storageLocationId: destinationType === "STORAGE" ? toStorageLocationId : null,
    quarantineProjectId: destinationType === "QUARANTINE" ? toQuarantineProjectId : null,
    status: destinationStatus as never
  };

  const result = await prisma.$transaction(async (tx) => {
    let destinationItemId: string | null = itemId;
    if (fullTransfer) {
      await tx.aquariumItem.update({
        where: { id: itemId },
        data: {
          aquariumId: destination.aquariumId,
          storageLocationId: destination.storageLocationId,
          quarantineProjectId: destination.quarantineProjectId,
          status: destination.status
        }
      });
    } else {
      const remainingQuantity = item.quantity - quantity;
      await tx.aquariumItem.update({ where: { id: itemId }, data: { quantity: remainingQuantity, ...fishSexCountsAfterQuantityChange({ itemType: item.itemType, quantity: remainingQuantity, maleCountApprox: item.maleCountApprox, femaleCountApprox: item.femaleCountApprox }) } });
      const destinationItem = await tx.aquariumItem.create({
        data: {
          collectionId: collection.id,
          aquariumId: destination.aquariumId,
          storageLocationId: destination.storageLocationId,
          quarantineProjectId: destination.quarantineProjectId,
          itemType: item.itemType,
          speciesDefinitionId: item.speciesDefinitionId,
          speciesVariantId: item.speciesVariantId,
          sourceId: item.sourceId,
          name: item.name,
          description: item.description,
          quantity,
          maleCountApprox: null,
          femaleCountApprox: null,
          unit: item.unit,
          status: destination.status,
          acquiredFrom: item.acquiredFrom,
          purchasePrice: item.purchasePrice,
          acquiredAt: item.acquiredAt,
          notes: item.notes
        }
      });
      destinationItemId = destinationItem.id;
    }

    if (destinationType === "QUARANTINE" && toQuarantineProjectId && destinationItemId) {
      await tx.quarantineItem.create({
        data: {
          quarantineProjectId: toQuarantineProjectId,
          itemId: destinationItemId,
          quantity,
          notes: reason
        }
      });
    }

    return tx.itemTransfer.create({
      data: {
        itemId,
        destinationItemId: fullTransfer ? null : destinationItemId,
        fromAquariumId: item.aquariumId,
        toAquariumId: destination.aquariumId,
        fromStorageLocationId: item.storageLocationId,
        toStorageLocationId: destination.storageLocationId,
        fromQuarantineProjectId: item.quarantineProjectId,
        toQuarantineProjectId: destination.quarantineProjectId,
        quantity,
        reason,
        notes,
        metadata: { destinationType },
        createdById: user.id
      }
    });
  });

  for (const aquariumId of [item.aquariumId, destination.aquariumId].filter(Boolean) as string[]) {
    await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId,
        eventType: "TRANSFER",
        title: `Transferred ${item.name}`,
        relatedItemId: itemId,
        summary: reason ?? `Moved to ${destinationType.toLowerCase()}`,
        createdById: user.id
      }
    });
  }

  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: itemId, action: "TRANSFER", before: item, after: result, createdById: user.id });
  if (!fullTransfer && JSON.stringify(fishSexAuditSnapshot(item)) !== JSON.stringify(sourceSexAfterPartial)) await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: itemId, action: "FISH_SEX_BREAKDOWN_UPDATED", before: fishSexAuditSnapshot(item), after: sourceSexAfterPartial, createdById: user.id });
  await auditRegionalSpeciesHandling({ collectionId: collection.id, userId: user.id, speciesDefinitionId: item.speciesDefinitionId, entityType: "AquariumItem", entityId: itemId, regional, workflow: "transfer inventory item" });
  revalidatePath("/inventory");
  revalidatePath("/storage");
  revalidatePath("/quarantine");
  revalidatePath("/dashboard");
  revalidatePath(`/inventory/${item.id}`);
  revalidatePath(`/equipment/${itemId}`);
  if (item.aquariumId) revalidatePath(`/aquariums/${item.aquariumId}`);
  if (destination.aquariumId) revalidatePath(`/aquariums/${destination.aquariumId}`);
  await setFormFlash(!fullTransfer && item.itemType === "FISH" ? `Transferred ${item.name}. Partial fish transfers clear the new group's sex breakdown; update counts manually if needed.` : `Transferred ${item.name}.`);
}

export async function attachEquipmentToAquarium(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const itemId = String(formData.get("itemId"));
  const role = String(formData.get("role") ?? "OTHER");
  if (!aquariumEquipmentRoles.includes(role as never)) throw new Error("Choose a valid aquarium equipment role.");
  const [aquarium, item] = await Promise.all([
    prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } }),
    prisma.aquariumItem.findFirstOrThrow({
      where: { id: itemId, collectionId: collection.id },
      include: {
        equipmentProfile: true,
        aquariumAttachments: { include: { aquarium: { select: { id: true, name: true, generatedName: true } } } }
      }
    })
  ]);
  if (!isAttachableAquariumItem(item.itemType)) throw new Error("Only equipment and substrate inventory can be attached to an aquarium profile.");
  const existingSameAttachment = item.aquariumAttachments.find((attachment) => attachment.aquariumId === aquarium.id && attachment.role === role);
  if (existingSameAttachment) throw new Error("This equipment is already attached to this aquarium with that role.");
  const otherAquariumAttachments = item.aquariumAttachments.filter((attachment) => attachment.aquariumId !== aquarium.id);
  const multiAssignmentConfirmed = checked(formData, "multiAssignmentConfirmed");
  if (otherAquariumAttachments.length && !item.equipmentProfile?.multiAquariumCapable && !multiAssignmentConfirmed) {
    throw new Error(`This equipment is already assigned to ${otherAquariumAttachments.map((attachment) => attachment.aquarium.generatedName ?? attachment.aquarium.name).join(", ")}. Confirm the multi-aquarium assignment before attaching it here too.`);
  }
  const attachment = await prisma.aquariumEquipmentAttachment.create({ data: { collectionId: collection.id, aquariumId: aquarium.id, itemId: item.id, role: role as never, notes: text(formData, "notes") } });
  await prisma.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId: aquarium.id, relatedItemId: item.id, eventType: "EQUIPMENT_CHANGE", title: `Attached ${item.name}`, summary: `${role.toLowerCase().replaceAll("_", " ")} role added to the equipment profile.`, createdById: user.id } });
  await writeAuditLog({
    collectionId: collection.id,
    entityType: "AquariumEquipmentAttachment",
    entityId: attachment.id,
    action: otherAquariumAttachments.length ? item.equipmentProfile?.multiAquariumCapable ? "EQUIPMENT_ATTACHED_TO_ADDITIONAL_AQUARIUM" : "EQUIPMENT_MULTI_ASSIGNMENT_OVERRIDE_CONFIRMED" : "EQUIPMENT_ATTACHED_TO_AQUARIUM",
    after: attachment,
    metadata: {
      itemId: item.id,
      aquariumId: aquarium.id,
      previouslyAssignedAquariumIds: otherAquariumAttachments.map((entry) => entry.aquariumId),
      multiAquariumCapable: item.equipmentProfile?.multiAquariumCapable ?? false,
      multiAssignmentConfirmed
    },
    createdById: user.id,
    severity: otherAquariumAttachments.length && !item.equipmentProfile?.multiAquariumCapable ? "WARNING" : "INFO"
  });
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/equipment");
  revalidatePath("/inventory");
  revalidatePath(`/equipment/${item.id}`);
  await setFormFlash(otherAquariumAttachments.length ? `Attached ${item.name} to ${aquarium.generatedName ?? aquarium.name} as ${item.equipmentProfile?.multiAquariumCapable ? "shared equipment" : "an override-confirmed multi-tank assignment"}.` : `Attached ${item.name} to ${aquarium.generatedName ?? aquarium.name}.`);
}

export async function detachEquipmentFromAquarium(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const attachmentId = String(formData.get("attachmentId"));
  const attachment = await prisma.aquariumEquipmentAttachment.findFirstOrThrow({ where: { id: attachmentId, aquariumId, collectionId: collection.id }, include: { item: true } });
  await prisma.$transaction(async (tx) => {
    await tx.aquariumEquipmentAttachment.delete({ where: { id: attachment.id } });
    if (attachment.role === "LIGHT") await tx.aquariumLightingAssignment.deleteMany({ where: { aquariumId, equipmentItemId: attachment.itemId } });
    await tx.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId,
        relatedItemId: attachment.itemId,
        eventType: "EQUIPMENT_CHANGE",
        title: `Detached ${attachment.item.name}`,
        summary: "Attachment removed; the inventory record was preserved.",
        createdById: user.id
      }
    });
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumEquipmentAttachment", entityId: attachment.id, action: "EQUIPMENT_DETACHED_FROM_AQUARIUM", before: attachment, metadata: { itemId: attachment.itemId, aquariumId }, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/equipment");
  revalidatePath("/inventory");
  revalidatePath(`/equipment/${attachment.itemId}`);
  await setFormFlash(`Detached ${attachment.item.name}.`);
}

export async function createQuarantineProject(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = text(formData, "aquariumId");
  if (aquariumId) await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const project = await prisma.quarantineProject.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      name: text(formData, "name") ?? "Quarantine project",
      reason: text(formData, "reason"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "QuarantineProject", entityId: project.id, action: "CREATE", after: project, createdById: user.id });
  revalidatePath("/quarantine");
  await setFormFlash(wantsCreateAndAddAnother(formData) ? `Created quarantine project: ${project.name}. Ready for another.` : `Created quarantine project: ${project.name}.`);
  redirect(wantsCreateAndAddAnother(formData) ? "/quarantine?create=1" : "/quarantine");
}

export async function updateQuarantineProjectStatus(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "COMPLETED");
  const before = await prisma.quarantineProject.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const project = await prisma.quarantineProject.update({
    where: { id },
    data: {
      status: status as never,
      completedAt: status === "COMPLETED" ? new Date() : null
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "QuarantineProject", entityId: id, action: "STATUS", before, after: project, createdById: user.id });
  revalidatePath("/quarantine");
  revalidatePath("/inventory");
  await setFormFlash(`Quarantine project marked ${status.toLowerCase()}.`);
}

export async function updateQuarantineItemStatus(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "CLEARED");
  const before = await prisma.quarantineItem.findFirstOrThrow({
    where: { id, quarantineProject: { collectionId: collection.id } },
    include: { item: true }
  });
  const item = await prisma.quarantineItem.update({
    where: { id },
    data: {
      status: status as never,
      clearedAt: status === "CLEARED" ? new Date() : null,
      notes: text(formData, "notes") ?? before.notes
    }
  });
  if (status === "CLEARED") {
    await prisma.aquariumItem.update({ where: { id: before.itemId }, data: { status: "IN_STORAGE", quarantineProjectId: null } });
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "QuarantineItem", entityId: id, action: "STATUS", before, after: item, createdById: user.id });
  revalidatePath("/quarantine");
  revalidatePath("/inventory");
  await setFormFlash(`Quarantine item marked ${status.toLowerCase()}.`);
}

export async function createEquipment(formData: FormData) {
  const { user, collection } = await getCollection();
  const equipmentType = String(formData.get("equipmentType") ?? "OTHER");
  const lightCapabilityProfileId = equipmentType === "LIGHT" ? text(formData, "lightCapabilityProfileId") : null;
  const output = lightOutputData(formData, equipmentType);
  if (lightCapabilityProfileId) {
    await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id: lightCapabilityProfileId, collectionId: collection.id } });
  }
  const item = await prisma.aquariumItem.create({
    data: {
      collectionId: collection.id,
      itemType: "EQUIPMENT",
      name: text(formData, "name") ?? "Unnamed equipment",
      quantity: 1,
      sourceId: text(formData, "sourceId"),
      purchasePrice: decimalString(formData, "purchasePrice"),
      notes: text(formData, "notes"),
      equipmentProfile: {
        create: {
          equipmentType: equipmentType as never,
          lightCapabilityProfileId,
          ...equipmentSharingData(formData),
          brand: text(formData, "brand"),
          model: text(formData, "model"),
          serialNumber: text(formData, "serialNumber"),
          ...output,
          purchaseDate: dateValue(formData, "purchaseDate"),
          warrantyUntil: dateValue(formData, "warrantyUntil"),
          maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
          lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
          notes: null
        }
      }
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "EquipmentProfile", entityId: item.id, action: "CREATE", after: item, createdById: user.id });
  revalidatePath("/equipment");
  revalidatePath("/inventory");
  await finishCreateFlow(formData, { detailUrl: `/equipment/${item.id}`, addAnotherUrl: "/equipment?create=1", createdMessage: `Created equipment: ${item.name}.`, addAnotherMessage: `Created equipment: ${item.name}. Ready for another.` });
}

export async function updateEquipment(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const equipmentType = String(formData.get("equipmentType") ?? "OTHER");
  const lightCapabilityProfileId = equipmentType === "LIGHT" ? text(formData, "lightCapabilityProfileId") : null;
  const output = lightOutputData(formData, equipmentType);
  if (lightCapabilityProfileId) {
    await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id: lightCapabilityProfileId, collectionId: collection.id } });
  }
  const before = await prisma.aquariumItem.findFirstOrThrow({
    where: { id: itemId, collectionId: collection.id, itemType: "EQUIPMENT" },
    include: { equipmentProfile: true }
  });
  const item = await prisma.aquariumItem.update({
    where: { id: itemId },
    data: {
      name: text(formData, "name") ?? before.name,
      sourceId: text(formData, "sourceId"),
      purchasePrice: decimalString(formData, "purchasePrice"),
      notes: text(formData, "notes"),
      equipmentProfile: {
        upsert: {
          create: {
            equipmentType: equipmentType as never,
            lightCapabilityProfileId,
            ...equipmentSharingData(formData),
            brand: text(formData, "brand"),
            model: text(formData, "model"),
            serialNumber: text(formData, "serialNumber"),
            ...output,
            purchaseDate: dateValue(formData, "purchaseDate"),
            warrantyUntil: dateValue(formData, "warrantyUntil"),
            maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
            lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
            notes: null
          },
          update: {
            equipmentType: equipmentType as never,
            lightCapabilityProfileId,
            ...equipmentSharingData(formData),
            brand: text(formData, "brand"),
            model: text(formData, "model"),
            serialNumber: text(formData, "serialNumber"),
            ...output,
            purchaseDate: dateValue(formData, "purchaseDate"),
            warrantyUntil: dateValue(formData, "warrantyUntil"),
            maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
            lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
            notes: null
          }
        }
      }
    },
    include: { equipmentProfile: true }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "EquipmentProfile", entityId: itemId, action: "UPDATE", before, after: item, createdById: user.id });
  if (before.equipmentProfile?.multiAquariumCapable !== item.equipmentProfile?.multiAquariumCapable) {
    await writeAuditLog({
      collectionId: collection.id,
      entityType: "EquipmentProfile",
      entityId: item.equipmentProfile?.id ?? itemId,
      action: "SHARED_EQUIPMENT_FLAG_CHANGED",
      before: { multiAquariumCapable: before.equipmentProfile?.multiAquariumCapable ?? false },
      after: { multiAquariumCapable: item.equipmentProfile?.multiAquariumCapable ?? false },
      metadata: { itemId },
      createdById: user.id
    });
  }
  revalidatePath("/equipment");
  revalidatePath("/inventory");
  revalidatePath(`/equipment/${itemId}`);
  await setFormFlash(`Saved equipment: ${item.name}.`);
}

export async function duplicateEquipment(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const attachAquariumId = text(formData, "attachAquariumId");
  const role = String(formData.get("role") ?? "OTHER");
  const before = await prisma.aquariumItem.findFirstOrThrow({
    where: { id: itemId, collectionId: collection.id, itemType: "EQUIPMENT" },
    include: { equipmentProfile: true }
  });
  if (!before.equipmentProfile) throw new Error("Only complete equipment records can be duplicated.");
  if (attachAquariumId) await prisma.aquarium.findFirstOrThrow({ where: { id: attachAquariumId, collectionId: collection.id } });
  if (attachAquariumId && !aquariumEquipmentRoles.includes(role as never)) throw new Error("Choose a valid aquarium equipment role.");
  const similarCount = await prisma.aquariumItem.count({ where: { collectionId: collection.id, itemType: "EQUIPMENT", name: { startsWith: before.name } } });
  const copyName = similarCount > 1 ? `${before.name} ${similarCount + 1}` : `Copy of ${before.name}`;
  const created = await prisma.aquariumItem.create({
    data: {
      collectionId: collection.id,
      itemType: "EQUIPMENT",
      name: copyName,
      description: before.description,
      quantity: 1,
      unit: before.unit,
      notes: before.notes,
      equipmentProfile: {
        create: {
          equipmentType: before.equipmentProfile.equipmentType,
          lightCapabilityProfileId: before.equipmentProfile.lightCapabilityProfileId,
          multiAquariumCapable: before.equipmentProfile.multiAquariumCapable,
          brand: before.equipmentProfile.brand,
          model: before.equipmentProfile.model,
          serialNumber: null,
          maxLumens: before.equipmentProfile.maxLumens,
          wattage: before.equipmentProfile.wattage,
          outputEstimateMethod: before.equipmentProfile.outputEstimateMethod,
          efficacyLumensPerWatt: before.equipmentProfile.efficacyLumensPerWatt,
          purchaseDate: null,
          warrantyUntil: null,
          maintenanceIntervalDays: before.equipmentProfile.maintenanceIntervalDays,
          lastMaintainedAt: null,
          notes: before.equipmentProfile.notes
        }
      }
    },
    include: { equipmentProfile: true }
  });
  const qr = await ensureQrCode({ collectionId: collection.id, entityType: "EQUIPMENT", entityId: created.id, label: created.name });
  let attachment = null;
  if (attachAquariumId) {
    attachment = await prisma.aquariumEquipmentAttachment.create({ data: { collectionId: collection.id, aquariumId: attachAquariumId, itemId: created.id, role: role as never } });
    await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId: attachAquariumId,
        relatedItemId: created.id,
        eventType: "EQUIPMENT_CHANGE",
        title: `Attached ${created.name}`,
        summary: `Duplicated from ${before.name} and attached as ${role.toLowerCase().replaceAll("_", " ")}.`,
        createdById: user.id
      }
    });
  }
  await writeAuditLog({
    collectionId: collection.id,
    entityType: "AquariumItem",
    entityId: created.id,
    action: "EQUIPMENT_DUPLICATED",
    after: created,
    metadata: { originalEquipmentId: before.id, newEquipmentId: created.id, qrCodeId: qr.id, attachedAquariumId: attachAquariumId, attachmentId: attachment?.id ?? null },
    createdById: user.id
  });
  revalidatePath("/equipment");
  revalidatePath("/inventory");
  revalidatePath(`/equipment/${before.id}`);
  revalidatePath(`/equipment/${created.id}`);
  if (attachAquariumId) revalidatePath(`/aquariums/${attachAquariumId}`);
  await setFormFlash(`Duplicated equipment: ${created.name}.`);
  redirect(`/equipment/${created.id}`);
}

export async function markEquipmentMaintained(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id }, include: { equipmentProfile: true, aquariumAttachments: true } });
  const profile = await prisma.equipmentProfile.update({
    where: { itemId },
    data: { lastMaintainedAt: new Date() }
  });
  for (const aquariumId of new Set(item.aquariumAttachments.map((attachment) => attachment.aquariumId))) {
    await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId,
        eventType: "EQUIPMENT_MAINTENANCE",
        title: `Maintained ${item.name}`,
        relatedItemId: item.id,
        createdById: user.id
      }
    });
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "EquipmentProfile", entityId: profile.id, action: "MARK_MAINTAINED", before: item.equipmentProfile, after: profile, createdById: user.id });
  revalidatePath("/equipment");
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath(`/equipment/${itemId}`);
  await setFormFlash(`Marked ${item.name} maintained.`);
}

export async function createLocation(formData: FormData) {
  const { user, collection } = await getCollection();
  const location = await prisma.location.create({
    data: {
      collectionId: collection.id,
      parentId: text(formData, "parentId"),
      name: text(formData, "name") ?? "Unnamed location",
      type: String(formData.get("type") ?? "OTHER") as never,
      description: text(formData, "description"),
      sortOrder: numberValue(formData, "sortOrder") ?? 0
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "Location", entityId: location.id, action: "CREATE", after: location, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/collection");
  revalidatePath("/aquariums");
  revalidatePath("/storage");
  const returnTo = text(formData, "returnTo") ?? "/collection";
  await setFormFlash(wantsCreateAndAddAnother(formData) ? `Created location: ${location.name}. Ready for another.` : `Created location: ${location.name}.`);
  redirect(wantsCreateAndAddAnother(formData) ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}create=1` : returnTo);
}

export async function updateLocation(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.location.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const location = await prisma.location.update({
    where: { id },
    data: {
      parentId: text(formData, "parentId"),
      name: text(formData, "name") ?? before.name,
      type: String(formData.get("type") ?? before.type) as never,
      description: text(formData, "description"),
      sortOrder: numberValue(formData, "sortOrder") ?? before.sortOrder
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "Location", entityId: location.id, action: "UPDATE", before, after: location, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/aquariums");
  await setFormFlash(`Saved location: ${location.name}.`);
}

export async function deleteLocation(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.location.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  await prisma.location.delete({ where: { id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "Location", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/aquariums");
  await setFormFlash("Location deleted.");
}

export async function createStorageLocation(formData: FormData) {
  formData.set("type", String(formData.get("type") || "BIN"));
  await createLocation(formData);
  revalidatePath("/storage");
}

export async function updateStorageLocation(formData: FormData) {
  await updateLocation(formData);
  revalidatePath("/storage");
}

export async function deleteStorageLocation(formData: FormData) {
  const { collection } = await getCollection();
  const id = String(formData.get("id"));
  const used = await prisma.aquariumItem.count({ where: { collectionId: collection.id, storageLocationId: id } });
  if (used > 0) throw new Error("Move stored items out of this location before deleting it.");
  await deleteLocation(formData);
  revalidatePath("/storage");
}

export async function createSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const source = await prisma.source.create({
    data: {
      collectionId: collection.id,
      name: text(formData, "name") ?? "Unnamed source",
      type: String(formData.get("type") ?? "OTHER") as never,
      website: text(formData, "website"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "Source", entityId: source.id, action: "CREATE", after: source, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/collection");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
  await setFormFlash(wantsCreateAndAddAnother(formData) ? `Created source: ${source.name}. Ready for another.` : `Created source: ${source.name}.`);
  redirect(wantsCreateAndAddAnother(formData) ? "/collection?create=1" : "/collection");
}

export async function updateSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.source.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const source = await prisma.source.update({
    where: { id },
    data: {
      name: text(formData, "name") ?? before.name,
      type: String(formData.get("type") ?? before.type) as never,
      website: text(formData, "website"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "Source", entityId: source.id, action: "UPDATE", before, after: source, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
  await setFormFlash(`Saved source: ${source.name}.`);
}

export async function deleteSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.source.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  await prisma.source.delete({ where: { id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "Source", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
  await setFormFlash("Source deleted.");
}

export async function sendCollectionInvitation(formData: FormData) {
  const { user, collection } = await getCollection(collectionOwnerRoles);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const requestedRole = String(formData.get("role") ?? "VIEWER");
  const role = requestedRole === "AQUARIST" || requestedRole === "FISHKEEPER" ? requestedRole : "VIEWER";
  if (!email) throw new Error("Invitation email is required.");

  const token = randomBytes(32).toString("base64url");
  const invitation = await prisma.collectionInvitation.create({
    data: {
      collectionId: collection.id,
      email,
      role: role as never,
      tokenHash: hashToken(token),
      inviterId: user.id,
      expiresAt: addDays(new Date(), 14)
    }
  });

  await sendEmail({
    ...invitationEmail({
      collectionName: collection.name,
      inviterName: user.name,
      role,
      acceptUrl: appUrl(`/invite/${token}`)
    }),
    to: email,
    collectionId: collection.id,
    userId: user.id,
    template: "collection-invitation",
    entityType: "CollectionInvitation",
    entityId: invitation.id
  });

  await writeAuditLog({
    collectionId: collection.id,
    entityType: "CollectionInvitation",
    entityId: invitation.id,
    action: "SEND",
    after: { email, role },
    createdById: user.id
  });
  revalidatePath("/settings");
  await setFormFlash(`Invitation sent to ${email}.`);
}

export async function createCareSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = text(formData, "aquariumId");
  if (aquariumId) {
    await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  }
  const startDate = dateValue(formData, "startDate") ?? new Date();
  const cadenceType = String(formData.get("cadenceType") ?? "WEEKLY");
  const intervalDays = numberValue(formData, "intervalDays");
  const dayOfMonth = numberValue(formData, "dayOfMonth");
  const schedule = await prisma.careSchedule.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      name: text(formData, "name") ?? "Care schedule",
      description: text(formData, "description"),
      scheduleType: String(formData.get("scheduleType") ?? "MAINTENANCE") as never,
      cadenceType: cadenceType as never,
      intervalDays,
      daysOfWeek: text(formData, "daysOfWeek") ? text(formData, "daysOfWeek")?.split(",").map((day) => day.trim()).filter(Boolean) : undefined,
      dayOfMonth,
      startDate,
      endDate: dateValue(formData, "endDate"),
      nextDueAt: startDate,
      enabled: String(formData.get("enabled") ?? "on") !== "off"
    }
  });
  await createPendingTaskForSchedule(schedule);
  await writeAuditLog({ collectionId: collection.id, entityType: "CareSchedule", entityId: schedule.id, action: "CREATE", after: schedule, createdById: user.id });
  revalidatePath("/schedules");
  revalidatePath("/dashboard");
  if (aquariumId) revalidatePath(`/aquariums/${aquariumId}`);
  await setFormFlash(wantsCreateAndAddAnother(formData) ? `Created schedule: ${schedule.name}. Ready for another.` : `Created schedule: ${schedule.name}.`);
  redirect(wantsCreateAndAddAnother(formData) ? "/schedules?create=1" : "/schedules");
}

export async function completeCareTask(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const id = String(formData.get("id"));
  const createEvent = String(formData.get("createEvent") ?? "on") !== "off";
  const before = await prisma.careTask.findFirstOrThrow({
    where: { id, careSchedule: { collectionId: collection.id } },
    include: { careSchedule: true, aquarium: true }
  });
  const completedAt = new Date();
  let relatedEventId: string | null = null;
  if (createEvent && before.aquariumId) {
    const eventType = before.careSchedule.scheduleType === "FEEDING"
      ? "FEEDING"
      : before.careSchedule.scheduleType === "TESTING"
        ? "TEST_RESULT"
        : before.careSchedule.scheduleType === "WATER_CHANGE"
          ? "WATER_CHANGE"
          : "MAINTENANCE";
    const event = await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId: before.aquariumId,
        eventType: eventType as never,
        title: before.title,
        summary: before.description,
        eventDate: completedAt,
        createdById: user.id
      }
    });
    relatedEventId = event.id;
  }
  const task = await prisma.careTask.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt,
      completedById: user.id,
      relatedEventId
    }
  });

  const nextDueAt = nextDueDate(before.dueAt, before.careSchedule.cadenceType, before.careSchedule.intervalDays, before.careSchedule.dayOfMonth);
  if (nextDueAt && (!before.careSchedule.endDate || nextDueAt <= before.careSchedule.endDate) && before.careSchedule.enabled) {
    const schedule = await prisma.careSchedule.update({
      where: { id: before.careScheduleId },
      data: { nextDueAt },
    });
    await createPendingTaskForSchedule(schedule);
  } else {
    await prisma.careSchedule.update({ where: { id: before.careScheduleId }, data: { nextDueAt: null } });
  }

  await writeAuditLog({ collectionId: collection.id, entityType: "CareTask", entityId: id, action: "COMPLETE", before, after: task, createdById: user.id });
  revalidatePath("/schedules");
  revalidatePath("/dashboard");
  if (before.aquariumId) revalidatePath(`/aquariums/${before.aquariumId}`);
  await setFormFlash("Care task completed.");
}

export async function skipCareTask(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const id = String(formData.get("id"));
  const before = await prisma.careTask.findFirstOrThrow({
    where: { id, careSchedule: { collectionId: collection.id } },
    include: { careSchedule: true }
  });
  const task = await prisma.careTask.update({
    where: { id },
    data: { status: "SKIPPED", skippedAt: new Date() }
  });
  const nextDueAt = nextDueDate(before.dueAt, before.careSchedule.cadenceType, before.careSchedule.intervalDays, before.careSchedule.dayOfMonth);
  if (nextDueAt && before.careSchedule.enabled) {
    const schedule = await prisma.careSchedule.update({ where: { id: before.careScheduleId }, data: { nextDueAt } });
    await createPendingTaskForSchedule(schedule);
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "CareTask", entityId: id, action: "SKIP", before, after: task, createdById: user.id });
  revalidatePath("/schedules");
  revalidatePath("/dashboard");
  if (before.aquariumId) revalidatePath(`/aquariums/${before.aquariumId}`);
  await setFormFlash("Care task skipped.");
}

export async function logFeeding(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const aquariumId = String(formData.get("aquariumId"));
  const foodItemId = text(formData, "foodItemId");
  const targetItemId = text(formData, "targetItemId");
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  if (foodItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: foodItemId, collectionId: collection.id, itemType: "FOOD" } });
  }
  if (targetItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: targetItemId, aquariumId, collectionId: collection.id } });
  }
  const foodItem = foodItemId ? await prisma.aquariumItem.findUnique({ where: { id: foodItemId } }) : null;
  const amount = text(formData, "amount");
  const targets = text(formData, "targetInhabitants");
  const fedAt = dateValue(formData, "fedAt") ?? new Date();
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedItemId: foodItemId,
      eventType: "FEEDING",
      title: text(formData, "title") ?? "Feeding",
      summary: [amount ? `Amount: ${amount}` : null, targets ? `Targets: ${targets}` : null].filter(Boolean).join(" · ") || null,
      notes: text(formData, "notes"),
      eventDate: fedAt,
      createdById: user.id
    }
  });
  await prisma.feedingEvent.create({
    data: {
      aquariumEventId: event.id,
      aquariumId,
      foodItemId,
      targetItemId,
      foodNameSnapshot: foodItem?.name ?? text(formData, "foodName"),
      amount,
      target: targets,
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumEvent", entityId: event.id, action: "LOG_FEEDING", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createAquariumEvent(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const eventType = String(formData.get("eventType") ?? "NOTE");
  const relatedItemId = text(formData, "relatedItemId");
  if (relatedItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: relatedItemId, collectionId: collection.id } });
  }
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      eventType: eventType as never,
      relatedItemId,
      title: text(formData, "title") ?? eventType,
      summary: text(formData, "summary"),
      notes: text(formData, "notes"),
      maintenanceType: text(formData, "maintenanceType"),
      waterChangePercent: numberValue(formData, "waterChangePercent"),
      waterChangeGallons: numberValue(formData, "waterChangeGallons"),
      eventDate: dateValue(formData, "eventDate") ?? new Date(),
      createdById: user.id
    }
  });

  const parameter = text(formData, "parameter");
  const value = numberValue(formData, "value");
  const unit = text(formData, "unit");
  if (eventType === "TEST_RESULT" && parameter && value !== null && unit) {
    await prisma.waterParameterReading.create({
      data: {
        aquariumId,
        parameter: parameter as never,
        value,
        unit,
        measuredAt: event.eventDate,
        notes: text(formData, "notes")
      }
    });
  }

  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumEvent", entityId: event.id, action: "CREATE", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createMaintenanceEvent(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const equipmentItemId = text(formData, "equipmentItemId");
  if (equipmentItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: equipmentItemId, collectionId: collection.id, itemType: "EQUIPMENT" } });
  }
  const maintenanceType = String(formData.get("maintenanceType") ?? "OTHER");
  const eventDate = dateValue(formData, "eventDate") ?? new Date();
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedItemId: equipmentItemId,
      eventType: maintenanceType === "WATER_CHANGE" ? "WATER_CHANGE" : "MAINTENANCE",
      title: text(formData, "title") ?? `Maintenance: ${maintenanceType.replaceAll("_", " ").toLowerCase()}`,
      summary: text(formData, "summary"),
      notes: text(formData, "notes"),
      maintenanceType,
      eventDate,
      createdById: user.id
    }
  });
  await prisma.maintenanceEvent.create({
    data: {
      aquariumEventId: event.id,
      aquariumId,
      maintenanceType: maintenanceType as never,
      equipmentItemId,
      summary: text(formData, "summary"),
      notes: text(formData, "notes")
    }
  });
  if (equipmentItemId && String(formData.get("markMaintained") ?? "on") !== "off") {
    await prisma.equipmentProfile.updateMany({ where: { itemId: equipmentItemId }, data: { lastMaintainedAt: eventDate } });
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumEvent", entityId: event.id, action: "LOG_MAINTENANCE", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/equipment");
  revalidatePath("/dashboard");
  if (equipmentItemId) {
    revalidatePath(`/inventory/${equipmentItemId}`);
    revalidatePath(`/equipment/${equipmentItemId}`);
  }
}

export async function logWaterChange(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const eventDate = dateValue(formData, "eventDate") ?? new Date();
  const gallons = numberValue(formData, "volumeGallons");
  const percent = numberValue(formData, "percentChanged");
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      eventType: "WATER_CHANGE",
      title: text(formData, "title") ?? "Water change",
      summary: [gallons !== null ? `${gallons} gal` : null, percent !== null ? `${percent}%` : null, text(formData, "waterSource")].filter(Boolean).join(" · ") || null,
      notes: text(formData, "notes"),
      maintenanceType: "WATER_CHANGE",
      waterChangeGallons: gallons,
      waterChangePercent: percent,
      eventDate,
      createdById: user.id
    }
  });
  await prisma.waterChangeEvent.create({
    data: {
      aquariumEventId: event.id,
      aquariumId,
      volumeGallons: gallons,
      percentChanged: percent,
      waterSource: text(formData, "waterSource"),
      conditionerUsed: text(formData, "conditionerUsed"),
      temperatureMatched: formData.get("temperatureMatched") === "on",
      beforeNotes: text(formData, "beforeNotes"),
      afterNotes: text(formData, "afterNotes"),
      parameterNotes: text(formData, "parameterNotes"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumEvent", entityId: event.id, action: "LOG_WATER_CHANGE", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function addInhabitant(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const itemType = String(formData.get("itemType") ?? "FISH");
  const { species, speciesDefinitionId, speciesVariantId } = await speciesAndVariantForItemType(collection.id, itemType, text(formData, "speciesDefinitionId"), text(formData, "speciesVariantId"), { tankInhabitant: true });
  await validateSpeciesPlacement(collection.id, aquariumId, speciesDefinitionId);
  const regional = await validateRegionalSpeciesHandling({ collectionId: collection.id, userId: user.id, speciesDefinitionId, formData });
  const unit = text(formData, "unit") ?? defaultUnitForItemType(itemType) ?? (itemType === "PLANT" ? "plants" : "fish");
  const quantity = normalizeQuantityInput(formData.get("quantity"), itemType, unit, 1);
  if (quantity <= 0) throw new Error("Quantity must be greater than zero.");
  const fishSexCounts = normalizeFishSexCounts({ itemType, quantity, maleCountApprox: formData.get("maleCountApprox"), femaleCountApprox: formData.get("femaleCountApprox") });
  const sourceId = text(formData, "sourceId");
  const purchasePrice = decimalString(formData, "purchasePrice");
  const acquiredAt = dateValue(formData, "acquiredAt");
  const notes = text(formData, "notes");
  const name = text(formData, "name") ?? displayNameForSpecies(species) ?? "Unnamed inhabitant";
  const existingItemId = text(formData, "existingItemId");
  const explicitExistingItem = existingItemId
    ? await prisma.aquariumItem.findFirstOrThrow({
        where: { id: existingItemId, collectionId: collection.id, aquariumId, itemType: itemType as never, ...(speciesDefinitionId ? { speciesDefinitionId } : {}), ...(speciesVariantId ? { speciesVariantId } : {}) }
      })
    : null;
  const matchingItem = !existingItemId && speciesDefinitionId && !sourceId && !purchasePrice && !acquiredAt
    ? await prisma.aquariumItem.findFirst({
        where: { collectionId: collection.id, aquariumId, itemType: itemType as never, speciesDefinitionId, speciesVariantId, status: { in: ["ACTIVE", "IN_AQUARIUM"] } },
        orderBy: { createdAt: "asc" }
      })
    : null;
  const targetExistingItem = explicitExistingItem || matchingItem;
  const nextExistingSexCounts = targetExistingItem
    ? fishSexCountsAfterQuantityChange({
        itemType,
        quantity: targetExistingItem.quantity + quantity,
        maleCountApprox: fishSexCounts.maleCountApprox == null && targetExistingItem.maleCountApprox == null ? null : (targetExistingItem.maleCountApprox ?? 0) + (fishSexCounts.maleCountApprox ?? 0),
        femaleCountApprox: fishSexCounts.femaleCountApprox == null && targetExistingItem.femaleCountApprox == null ? null : (targetExistingItem.femaleCountApprox ?? 0) + (fishSexCounts.femaleCountApprox ?? 0)
      })
    : null;
  const item = targetExistingItem
    ? await prisma.aquariumItem.update({
        where: { id: targetExistingItem.id },
        data: {
          quantity: { increment: quantity },
          ...(nextExistingSexCounts ?? {}),
          status: "IN_AQUARIUM",
          aquariumId
        }
      })
    : await prisma.aquariumItem.create({
        data: {
          collectionId: collection.id,
          aquariumId,
          itemType: itemType as never,
          speciesDefinitionId,
          speciesVariantId,
          sourceId,
          name,
          quantity,
          ...fishSexCounts,
          unit,
          status: "IN_AQUARIUM",
          purchasePrice,
          acquiredAt,
          notes
        }
      });
  const eventType = itemType === "PLANT" ? "PLANT_ADDITION" : "LIVESTOCK_ADDITION";
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedItemId: item.id,
      relatedSpeciesId: speciesDefinitionId,
      eventType,
      title: `Added ${quantity} ${item.name}`,
      summary: sourceId || purchasePrice || acquiredAt ? "Acquisition details are linked on the inventory record." : null,
      notes,
      eventDate: acquiredAt ?? new Date(),
      createdById: user.id,
      metadata: { quantity, itemType }
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: item.id, action: eventType, after: { item, event }, createdById: user.id });
  if (JSON.stringify(fishSexAuditSnapshot(targetExistingItem ?? { itemType, maleCountApprox: null, femaleCountApprox: null })) !== JSON.stringify(fishSexAuditSnapshot(item))) await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: item.id, action: "FISH_SEX_BREAKDOWN_UPDATED", before: fishSexAuditSnapshot(targetExistingItem ?? { itemType, maleCountApprox: null, femaleCountApprox: null }), after: fishSexAuditSnapshot(item), createdById: user.id });
  await auditRegionalSpeciesHandling({ collectionId: collection.id, userId: user.id, speciesDefinitionId, entityType: "AquariumItem", entityId: item.id, regional, workflow: "add aquarium inhabitant" });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath(`/inventory/${item.id}`);
  await setFormFlash("Added to tank.");
}

export async function logInhabitantLoss(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const aquariumId = String(formData.get("aquariumId"));
  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, aquariumId, collectionId: collection.id } });
  const quantity = Math.max(normalizeQuantityInput(formData.get("quantity"), item.itemType, item.unit, 1), 0);
  const remaining = Math.max(item.quantity - quantity, 0);
  const removeFromInventory = String(formData.get("removeFromInventory") ?? "on") !== "off";
  const status = remaining <= 0 && removeFromInventory ? (item.itemType === "PLANT" ? "REMOVED" : "DEAD") : item.status;
  const updated = await prisma.aquariumItem.update({ where: { id: item.id }, data: { quantity: remaining, status, ...fishSexCountsAfterQuantityChange({ itemType: item.itemType, quantity: remaining, maleCountApprox: item.maleCountApprox, femaleCountApprox: item.femaleCountApprox }) } });
  const eventType = item.itemType === "PLANT" ? "PLANT_REMOVAL" : "LIVESTOCK_LOSS";
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedItemId: item.id,
      relatedSpeciesId: item.speciesDefinitionId,
      eventType,
      title: `${item.itemType === "PLANT" ? "Removed" : "Lost"} ${quantity} ${item.name}`,
      summary: text(formData, "suspectedCause"),
      notes: text(formData, "notes"),
      eventDate: dateValue(formData, "eventDate") ?? new Date(),
      createdById: user.id,
      metadata: { quantity, remaining, removeFromInventory }
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: item.id, action: eventType, before: item, after: { item: updated, event }, createdById: user.id });
  if (JSON.stringify(fishSexAuditSnapshot(item)) !== JSON.stringify(fishSexAuditSnapshot(updated))) await writeAuditLog({ collectionId: collection.id, entityType: "AquariumItem", entityId: item.id, action: "FISH_SEX_BREAKDOWN_UPDATED", before: fishSexAuditSnapshot(item), after: fishSexAuditSnapshot(updated), createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath(`/inventory/${itemId}`);
}

export async function createMedicationDefinition(formData: FormData) {
  const { user, collection } = await getCollection();
  const definition = await prisma.medicationDefinition.create({
    data: {
      collectionId: collection.id,
      name: text(formData, "name") ?? "Unnamed medication",
      manufacturer: text(formData, "manufacturer"),
      medicationType: String(formData.get("medicationType") ?? "OTHER") as never,
      activeIngredients: text(formData, "activeIngredients"),
      concentration: text(formData, "concentration"),
      defaultDoseAmount: numberValue(formData, "defaultDoseAmount"),
      defaultDoseUnit: text(formData, "defaultDoseUnit"),
      dosePerGallons: String(formData.get("doseVolumeUnit")) === "LITER" ? null : numberValue(formData, "dosePerVolume"),
      dosePerVolume: numberValue(formData, "dosePerVolume"),
      doseVolumeUnit: String(formData.get("doseVolumeUnit") ?? "GALLON") as never,
      repeatIntervalHours: numberValue(formData, "repeatIntervalHours"),
      courseLengthDays: numberValue(formData, "courseLengthDays"),
      waterChangeGuidance: text(formData, "waterChangeGuidance"),
      scheduleNotes: text(formData, "scheduleNotes"),
      safetyNotes: text(formData, "safetyNotes"),
      contraindications: text(formData, "contraindications")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "MedicationDefinition", entityId: definition.id, action: "CREATE", after: definition, createdById: user.id });
  revalidatePath("/medications");
  await setFormFlash(wantsCreateAndAddAnother(formData) ? `Created medication: ${definition.name}. Ready for another.` : `Created medication: ${definition.name}.`);
  redirect(wantsCreateAndAddAnother(formData) ? "/medications?create=1" : "/medications");
}

export async function updateMedicationDefinition(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.medicationDefinition.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const definition = await prisma.medicationDefinition.update({
    where: { id },
    data: {
      name: text(formData, "name") ?? before.name,
      manufacturer: text(formData, "manufacturer"),
      medicationType: String(formData.get("medicationType") ?? before.medicationType) as never,
      activeIngredients: text(formData, "activeIngredients"),
      concentration: text(formData, "concentration"),
      defaultDoseAmount: numberValue(formData, "defaultDoseAmount"),
      defaultDoseUnit: text(formData, "defaultDoseUnit"),
      dosePerGallons: String(formData.get("doseVolumeUnit")) === "LITER" ? null : numberValue(formData, "dosePerVolume"),
      dosePerVolume: numberValue(formData, "dosePerVolume"),
      doseVolumeUnit: String(formData.get("doseVolumeUnit") ?? "GALLON") as never,
      repeatIntervalHours: numberValue(formData, "repeatIntervalHours"),
      courseLengthDays: numberValue(formData, "courseLengthDays"),
      waterChangeGuidance: text(formData, "waterChangeGuidance"),
      scheduleNotes: text(formData, "scheduleNotes"),
      safetyNotes: text(formData, "safetyNotes"),
      contraindications: text(formData, "contraindications")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "MedicationDefinition", entityId: definition.id, action: "UPDATE", before, after: definition, createdById: user.id });
  revalidatePath("/medications");
  await setFormFlash(`Saved medication: ${definition.name}.`);
}

export async function deleteMedicationDefinition(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const inUse = await prisma.medicationCourse.count({ where: { medicationDefinitionId: id, collectionId: collection.id } });
  if (inUse > 0) throw new Error("This medication has courses and cannot be deleted.");
  const before = await prisma.medicationDefinition.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  await prisma.medicationDefinition.delete({ where: { id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "MedicationDefinition", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/medications");
  await setFormFlash("Medication deleted.");
}

export async function startMedicationCourse(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const medicationDefinitionId = String(formData.get("medicationDefinitionId"));
  const conditionId = text(formData, "conditionId");
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const definition = await prisma.medicationDefinition.findFirstOrThrow({ where: { id: medicationDefinitionId, collectionId: collection.id } });
  const condition = conditionId ? await prisma.healthCondition.findFirstOrThrow({ where: { id: conditionId, collectionId: collection.id, aquariumId } }) : null;
  const { convertVolume } = await import("@/lib/units/volume");
  const tankVolume = numberValue(formData, "tankVolume") ?? aquarium.volumeGallons;
  const tankUnit = String(formData.get("tankVolumeUnit") ?? aquarium.volumeUnit ?? "GALLON") as "GALLON" | "LITER";
  const tankVolumeGallons = tankVolume ? convertVolume(tankVolume, tankUnit, "GALLON") : null;
  if (!tankVolumeGallons) throw new Error("Tank volume is required to calculate or confirm medication dose.");
  if (!tankVolume) throw new Error("Tank volume is required to calculate or confirm medication dose.");
  const doseBasis = definition.dosePerVolume ?? definition.dosePerGallons;
  const volumeInDoseUnit = convertVolume(tankVolume, tankUnit, definition.doseVolumeUnit);
  const calculatedDoseAmount = definition.defaultDoseAmount && doseBasis
    ? (volumeInDoseUnit / doseBasis) * definition.defaultDoseAmount
    : null;
  const actualDoseAmount = numberValue(formData, "actualDoseAmount") ?? calculatedDoseAmount;
  const actualDoseUnit = text(formData, "actualDoseUnit") ?? definition.defaultDoseUnit;
  if (actualDoseAmount === null || actualDoseAmount <= 0 || !actualDoseUnit) throw new Error("Confirm a positive dose amount and unit before starting treatment.");
  const doseType = String(formData.get("doseType") ?? "TREATMENT_START") === "ONE_OFF" ? "ONE_OFF" : "TREATMENT_START";
  const startedAt = dateValue(formData, "startedAt") ?? new Date();
  const course = await prisma.medicationCourse.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      medicationDefinitionId,
      title: text(formData, "title") ?? (doseType === "ONE_OFF" ? `${definition.name} one-off dose` : `${definition.name} course`),
      reason: text(formData, "reason"),
      tankVolumeGallons,
      calculatedDoseAmount,
      calculatedDoseUnit: definition.defaultDoseUnit,
      doseSchedule: {
        notes: text(formData, "doseSchedule") ?? definition.scheduleNotes,
        repeatIntervalHours: definition.repeatIntervalHours,
        courseLengthDays: definition.courseLengthDays,
        waterChangeGuidance: definition.waterChangeGuidance
      },
      startedAt,
      status: doseType === "ONE_OFF" ? "COMPLETED" : "ACTIVE",
      completedAt: doseType === "ONE_OFF" ? startedAt : null,
      notes: text(formData, "notes"),
      relatedConditionId: condition?.id ?? null
    }
  });
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedMedicationCourseId: course.id,
      relatedConditionId: condition?.id ?? null,
      eventType: "MEDICATION",
      title: doseType === "ONE_OFF" ? `Dosed ${definition.name}` : `Started ${course.title}`,
      summary: [doseType === "ONE_OFF" ? "one-off dose" : "treatment start", definition.name, `${Number(actualDoseAmount.toFixed(2))}${actualDoseUnit}`].filter(Boolean).join(" · "),
      notes: "Verify medication label directions before dosing.",
      eventDate: startedAt,
      createdById: user.id,
      metadata: { medicationDefinitionId, tankVolumeGallons, calculatedDoseAmount, calculatedDoseUnit: course.calculatedDoseUnit, actualDoseAmount, actualDoseUnit }
    }
  });
  await prisma.medicationDoseEvent.create({
    data: {
      aquariumEventId: event.id,
      medicationCourseId: course.id,
      doseAmount: actualDoseAmount,
      doseUnit: actualDoseUnit,
      recommendedDoseAmount: calculatedDoseAmount,
      recommendedDoseUnit: course.calculatedDoseUnit,
      doseType,
      doseNumber: 1,
      dosedAt: startedAt,
      notes: text(formData, "notes")
    }
  });
  if (condition) {
    await prisma.$transaction([
      prisma.healthCondition.update({ where: { id: condition.id }, data: { status: condition.status === "ACTIVE" ? "TREATING" : condition.status, updatedById: user.id } }),
      prisma.healthConditionLink.create({ data: { collectionId: collection.id, conditionId: condition.id, linkedEntityType: "MEDICATION_COURSE", linkedEntityId: course.id, relationship: "TREATED_BY" } }),
      prisma.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId, relatedConditionId: condition.id, relatedMedicationCourseId: course.id, eventType: "CONDITION_LINKED_MEDICATION", title: `Medication linked to ${condition.title}`, summary: course.title, eventDate: startedAt, createdById: user.id } })
    ]);
    await writeAuditLog({ collectionId: collection.id, entityType: "HealthCondition", entityId: condition.id, action: "CONDITION_MEDICATION_LINKED", after: { medicationCourseId: course.id }, createdById: user.id });
    revalidatePath(`/conditions/${condition.id}`);
    revalidatePath("/conditions");
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "MedicationCourse", entityId: course.id, action: "START", after: { course, event }, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/medications");
  revalidatePath("/dashboard");
  await setFormFlash(doseType === "ONE_OFF" ? "Medication dose logged." : `Started medication course: ${course.title}.`);
}

export async function logMedicationDose(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const medicationCourseId = String(formData.get("medicationCourseId"));
  const course = await prisma.medicationCourse.findFirstOrThrow({
    where: { id: medicationCourseId, collectionId: collection.id },
    include: { medicationDefinition: true }
  });
  const dosedAt = dateValue(formData, "dosedAt") ?? new Date();
  const doseAmount = numberValue(formData, "doseAmount") ?? course.calculatedDoseAmount;
  const doseUnit = text(formData, "doseUnit") ?? course.calculatedDoseUnit;
  const requestedDoseType = String(formData.get("doseType") ?? "FOLLOW_UP");
  const doseType = ["ONE_OFF", "FOLLOW_UP", "TREATMENT_COMPLETION"].includes(requestedDoseType) ? requestedDoseType : "FOLLOW_UP";
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId: course.aquariumId,
      relatedMedicationCourseId: course.id,
      eventType: "MEDICATION",
      title: doseType === "TREATMENT_COMPLETION" ? `Completed treatment with ${course.medicationDefinition.name}` : `Dosed ${course.medicationDefinition.name}`,
      summary: [doseType.replaceAll("_", " ").toLowerCase(), doseAmount !== null ? `${Number(doseAmount.toFixed(2))}${doseUnit ?? ""}` : null].filter(Boolean).join(" · "),
      notes: text(formData, "notes"),
      eventDate: dosedAt,
      createdById: user.id
    }
  });
  const dose = await prisma.medicationDoseEvent.create({
    data: {
      aquariumEventId: event.id,
      medicationCourseId: course.id,
      doseAmount,
      doseUnit,
      recommendedDoseAmount: course.calculatedDoseAmount,
      recommendedDoseUnit: course.calculatedDoseUnit,
      doseType: doseType as never,
      doseNumber: numberValue(formData, "doseNumber"),
      dosedAt,
      notes: text(formData, "notes")
    }
  });
  if (doseType === "TREATMENT_COMPLETION") {
    await prisma.medicationCourse.update({ where: { id: course.id }, data: { status: "COMPLETED", completedAt: dosedAt } });
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "MedicationDoseEvent", entityId: dose.id, action: "CREATE", after: { dose, event }, createdById: user.id });
  revalidatePath(`/aquariums/${course.aquariumId}`);
  revalidatePath("/medications");
  revalidatePath("/dashboard");
  await setFormFlash("Medication dose logged.");
}

export async function updateMedicationCourseStatus(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "COMPLETED");
  const before = await prisma.medicationCourse.findFirstOrThrow({ where: { id, collectionId: collection.id }, include: { medicationDefinition: true } });
  const course = await prisma.medicationCourse.update({
    where: { id },
    data: { status: status as never, completedAt: status === "ACTIVE" ? null : new Date() }
  });
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId: before.aquariumId,
      relatedMedicationCourseId: id,
      eventType: "MEDICATION",
      title: `${status === "COMPLETED" ? "Completed" : "Cancelled"} ${before.title}`,
      summary: before.medicationDefinition.name,
      eventDate: new Date(),
      createdById: user.id
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "MedicationCourse", entityId: id, action: status, before, after: { course, event }, createdById: user.id });
  revalidatePath(`/aquariums/${before.aquariumId}`);
  revalidatePath("/medications");
  revalidatePath("/dashboard");
  await setFormFlash(`Medication course marked ${status.toLowerCase()}.`);
}

export async function createReading(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const reading = await prisma.waterParameterReading.create({
    data: {
      aquariumId,
      parameter: String(formData.get("parameter") ?? "OTHER") as never,
      value: numberValue(formData, "value") ?? 0,
      unit: text(formData, "unit") ?? "",
      measuredAt: dateValue(formData, "measuredAt") ?? new Date(),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterParameterReading", entityId: reading.id, action: "CREATE", after: reading, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
  await setFormFlash("Water reading saved.");
}

export async function createReadingsBatch(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const measuredAt = dateValue(formData, "measuredAt") ?? new Date();
  const notes = text(formData, "notes");
  const readings = [
    ["temperature", "TEMPERATURE", "F"],
    ["ph", "PH", "pH"],
    ["ammonia", "AMMONIA", "ppm"],
    ["nitrite", "NITRITE", "ppm"],
    ["nitrate", "NITRATE", "ppm"],
    ["gh", "GH", "dGH"],
    ["kh", "KH", "dKH"],
    ["tds", "TDS", "ppm"],
    ["turbidity", "TURBIDITY", "NTU"],
    ["co2", "CO2", "ppm"],
    ["light", "LIGHT", "PAR"],
    ["waterLevel", "WATER_LEVEL", "in"]
  ] as const;
  const data = readings.flatMap(([field, parameter, defaultUnit]) => {
    const value = numberValue(formData, field);
    if (value === null || Number.isNaN(value)) return [];
    return [{
      aquariumId,
      parameter,
      value,
      unit: text(formData, `${field}Unit`) ?? defaultUnit,
      measuredAt,
      notes
    }];
  });

  if (data.length) {
    const event = await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId,
        eventType: "TEST_RESULT",
        title: `Logged ${data.length} parameter reading${data.length === 1 ? "" : "s"}`,
        summary: data.map((reading) => `${reading.parameter}: ${reading.value}${reading.unit}`).join(", "),
        notes,
        eventDate: measuredAt,
        createdById: user.id
      }
    });
    await prisma.waterParameterReading.createMany({
      data: data.map((reading) => ({ ...reading, aquariumEventId: event.id }))
    });
  }

  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
  await setFormFlash(data.length ? `Saved ${data.length} water readings.` : "No readings were entered.");
}

export async function createLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const name = text(formData, "name") ?? "Unnamed schedule";
  const capabilityProfileId = text(formData, "capabilityProfileId");
  const profile = capabilityProfileId
    ? await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id: capabilityProfileId, collectionId: collection.id } })
    : await prisma.lightCapabilityProfile.findFirst({ where: { collectionId: collection.id }, orderBy: { name: "asc" } });
  if (!profile) throw new Error("Create a light capability profile before adding schedules.");
  const channels = parseLightChannels(profile.channels);
  const pointCount = Math.max(1, Math.min(numberValue(formData, "pointCount") ?? profile.pointCount, 8));
  const rampMinutes = scheduleRampMinutesFromForm(formData);
  const schedule = await prisma.lightingSchedule.create({
    data: {
      collectionId: collection.id,
      capabilityProfileId: profile.id,
      name,
      description: text(formData, "description"),
      rampMinutes,
      points: {
        create: Array.from({ length: pointCount }, (_, index) => {
          const values = pointValuesFromForm(formData, index, channels);
          const legacy = legacyPointValues(values);
          return {
            timeOfDay: text(formData, `point-${index}-time`) ?? (index === 0 ? "10:00" : index === pointCount - 1 ? "20:00" : "14:00"),
            ...legacy,
            rampMinutes,
            values,
            sortOrder: (index + 1) * 10
          };
        })
      }
    },
    include: { points: true, capabilityProfile: true }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "LightingSchedule", entityId: schedule.id, action: "CREATE", after: schedule, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/lighting-schedules");
  revalidatePath("/aquariums");
  await setFormFlash(wantsCreateAndAddAnother(formData) ? `Created lighting schedule: ${schedule.name}. Ready for another.` : `Created lighting schedule: ${schedule.name}.`);
  redirect(wantsCreateAndAddAnother(formData) ? "/lighting-schedules?create=1" : "/lighting-schedules");
}

export async function createLightCapabilityProfile(formData: FormData) {
  const { user, collection } = await getCollection();
  const channels = String(formData.get("channels") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, label = key] = entry.split(":").map((part) => part.trim());
      return { key, label, color: "#7dd3fc", min: 0, max: 100, step: 5 };
    });
  const profile = await prisma.lightCapabilityProfile.create({
    data: {
      collectionId: collection.id,
      name: text(formData, "name") ?? "Custom light profile",
      description: text(formData, "description"),
      mode: String(formData.get("mode") ?? "CUSTOM") as never,
      pointCount: numberValue(formData, "pointCount") ?? 3,
      channels: channels.length ? channels : [{ key: "intensity", label: "Intensity", color: "#f7d889", min: 0, max: 100, step: 5 }]
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "LightCapabilityProfile", entityId: profile.id, action: "CREATE", after: profile, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/equipment");
  await setFormFlash(`Created light capability: ${profile.name}.`);
}

export async function updateLightCapabilityProfile(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const profile = await prisma.lightCapabilityProfile.update({
    where: { id },
    data: {
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      mode: String(formData.get("mode") ?? before.mode) as never,
      pointCount: numberValue(formData, "pointCount") ?? before.pointCount
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "LightCapabilityProfile", entityId: id, action: "UPDATE", before, after: profile, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/equipment");
  await setFormFlash(`Saved light capability: ${profile.name}.`);
}

export async function deleteLightCapabilityProfile(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const usage = (await prisma.equipmentProfile.count({ where: { lightCapabilityProfileId: id } }))
    + (await prisma.lightingSchedule.count({ where: { capabilityProfileId: id } }));
  if (usage > 0) throw new Error("This capability profile is used by equipment or schedules.");
  await prisma.lightCapabilityProfile.delete({ where: { id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "LightCapabilityProfile", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/equipment");
  await setFormFlash("Light capability deleted.");
}

export async function updateLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightingSchedule.findFirstOrThrow({
    where: { id, collectionId: collection.id },
    include: { points: true, capabilityProfile: true }
  });
  const capabilityProfileId = text(formData, "capabilityProfileId") ?? before.capabilityProfileId;
  const profile = capabilityProfileId
    ? await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id: capabilityProfileId, collectionId: collection.id } })
    : null;
  if (!profile) throw new Error("Lighting schedules need a capability profile.");
  const channels = parseLightChannels(profile.channels);
  const pointCount = Math.max(1, Math.min((numberValue(formData, "pointCount") ?? before.points.length) || profile.pointCount, 8));
  const rampMinutes = scheduleRampMinutesFromForm(formData);
  await prisma.lightingSchedulePoint.deleteMany({ where: { scheduleId: id } });
  const schedule = await prisma.lightingSchedule.update({
    where: { id },
    data: {
      capabilityProfileId: profile.id,
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      rampMinutes,
      points: {
        create: Array.from({ length: pointCount }, (_, index) => {
          const values = pointValuesFromForm(formData, index, channels);
          const legacy = legacyPointValues(values);
          return {
            timeOfDay: text(formData, `point-${index}-time`) ?? before.points[index]?.timeOfDay ?? "12:00",
            ...legacy,
            rampMinutes,
            values,
            sortOrder: (index + 1) * 10
          };
        })
      }
    },
    include: { points: true, capabilityProfile: true }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "LightingSchedule", entityId: id, action: "UPDATE", before, after: schedule, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/aquariums");
  await setFormFlash(`Saved lighting schedule: ${schedule.name}.`);
}

export async function deleteLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightingSchedule.findFirstOrThrow({ where: { id, collectionId: collection.id }, include: { points: true } });
  const assignments = await prisma.aquariumLightingAssignment.count({ where: { scheduleId: id } });
  if (assignments > 0) throw new Error("Remove this schedule from lights before deleting it.");
  await prisma.lightingSchedule.delete({ where: { id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "LightingSchedule", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/aquariums");
  await setFormFlash("Lighting schedule deleted.");
}

export async function duplicateLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightingSchedule.findFirstOrThrow({
    where: { id, collectionId: collection.id },
    include: { points: { orderBy: { sortOrder: "asc" } } }
  });
  const schedule = await prisma.lightingSchedule.create({
    data: {
      collectionId: collection.id,
      capabilityProfileId: before.capabilityProfileId,
      name: `${before.name} copy`,
      description: before.description,
      points: {
        create: before.points.map((point) => ({
          timeOfDay: point.timeOfDay,
          white: point.white,
          red: point.red,
          green: point.green,
          blue: point.blue,
          warmWhite: point.warmWhite,
          intensity: point.intensity,
          rampMinutes: point.rampMinutes,
          values: point.values ?? undefined,
          sortOrder: point.sortOrder
        }))
      }
    },
    include: { points: true }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "LightingSchedule", entityId: schedule.id, action: "DUPLICATE", after: schedule, createdById: user.id });
  revalidatePath("/lighting-schedules");
  await setFormFlash(`Duplicated lighting schedule: ${schedule.name}.`);
}

export async function assignLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const equipmentItemId = text(formData, "equipmentItemId");
  const scheduleId = text(formData, "scheduleId");
  const enabled = formData.get("enabled") === "on";
  if (!equipmentItemId) throw new Error("Choose a light fixture before assigning a schedule.");
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const equipment = await prisma.aquariumItem.findFirstOrThrow({
    where: { id: equipmentItemId, collectionId: collection.id, itemType: "EQUIPMENT", aquariumAttachments: { some: { aquariumId, role: "LIGHT" } } },
    include: { equipmentProfile: true }
  });
  if (equipment.equipmentProfile?.equipmentType !== "LIGHT") throw new Error("Only light equipment can receive a lighting schedule.");
  if (!equipment.equipmentProfile.lightCapabilityProfileId) throw new Error("This light needs a capability profile before it can use schedules.");
  const schedule = scheduleId
    ? await prisma.lightingSchedule.findFirstOrThrow({ where: { id: scheduleId, collectionId: collection.id } })
    : null;
  if (schedule && schedule.capabilityProfileId !== equipment.equipmentProfile.lightCapabilityProfileId) {
    throw new Error("This schedule is not compatible with the selected light.");
  }
  const assignment = await prisma.aquariumLightingAssignment.upsert({
    where: { aquariumId_equipmentItemId: { aquariumId, equipmentItemId } },
    create: {
      aquariumId,
      equipmentItemId,
      scheduleId,
      enabled,
      notes: text(formData, "lightingAssignmentNotes")
    },
    update: {
      scheduleId,
      enabled,
      notes: text(formData, "lightingAssignmentNotes")
    },
    include: { schedule: true, equipmentItem: true }
  });
  await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      eventType: "EQUIPMENT_CHANGE",
      title: `Lighting updated for ${equipment.name}`,
      summary: schedule ? `Assigned ${schedule.name}` : "Lighting schedule cleared",
      relatedItemId: equipmentItemId,
      createdById: user.id
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumLightingAssignment", entityId: assignment.id, action: "UPSERT", after: assignment, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/lighting-schedules");
  revalidatePath("/equipment");
  revalidatePath("/settings");
  await setFormFlash(schedule ? `Assigned lighting schedule: ${schedule.name}.` : "Lighting schedule cleared.");
}

export async function clearLightingAssignment(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const assignment = await prisma.aquariumLightingAssignment.findFirstOrThrow({
    where: { id, aquarium: { collectionId: collection.id } },
    include: { aquarium: true }
  });
  await prisma.aquariumLightingAssignment.delete({ where: { id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumLightingAssignment", entityId: id, action: "DELETE", before: assignment, createdById: user.id });
  revalidatePath(`/aquariums/${assignment.aquariumId}`);
  revalidatePath("/lighting-schedules");
  revalidatePath("/equipment");
  await setFormFlash("Lighting assignment removed.");
}

export async function startWorkflow(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const workflowTemplateId = String(formData.get("workflowTemplateId"));
  const run = await startWorkflowRun({ collectionId: collection.id, workflowTemplateId, aquariumId, userId: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/workflows");
  await setFormFlash(`Started workflow: ${run.title}.`);
}

export async function completeWorkflowStep(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const id = String(formData.get("id"));
  const output = await completeWorkflowStepRun({ stepRunId: id, collectionId: collection.id, userId: user.id, action: "complete", notes: text(formData, "notes") });
  const run = await prisma.workflowRun.findUnique({ where: { id: output.stepRun.workflowRunId }, select: { aquariumId: true } });
  if (run?.aquariumId) revalidatePath(`/aquariums/${run.aquariumId}`);
  revalidatePath(`/workflows/runs/${output.stepRun.workflowRunId}`);
  revalidatePath("/workflows");
  await setFormFlash(output.remaining === 0 ? "Workflow completed." : "Workflow step completed.");
}

export async function generateQrCode(formData: FormData) {
  const { user, collection } = await getCollection(careRoles);
  const entityType = String(formData.get("entityType"));
  const entityId = String(formData.get("entityId"));
  const label = text(formData, "label") ?? `${entityType} ${entityId}`;
  const qr = await ensureQrCode({ collectionId: collection.id, entityType, entityId, label });
  await writeAuditLog({ collectionId: collection.id, entityType, entityId, action: "GENERATE_QR", after: qr, createdById: user.id });
  revalidatePath("/aquariums");
  revalidatePath("/equipment");
  revalidatePath(`/inventory/${entityId}`);
  revalidatePath(`/equipment/${entityId}`);
  await setFormFlash("QR code generated.");
}
