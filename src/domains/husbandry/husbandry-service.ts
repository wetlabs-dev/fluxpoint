import { prisma } from "@/lib/db/prisma";
import {
  hasHusbandryData,
  inferSpeciesHusbandryType,
  mergeHusbandryValues,
  normalizeHusbandryFields,
  parseHusbandryFormData,
  type HusbandrySpeciesType
} from "@/domains/husbandry/husbandry-fields";

export async function getSpeciesHusbandryGuide(speciesDefinitionId: string) {
  return prisma.speciesHusbandryGuide.findUnique({ where: { speciesDefinitionId }, include: { sourceSpeciesDefinition: true, speciesDefinition: true } });
}

export async function getResolvedSpeciesHusbandryGuide(speciesDefinitionId: string, seen = new Set<string>()): Promise<any | null> {
  if (seen.has(speciesDefinitionId)) throw new Error("Circular husbandry guide link detected.");
  seen.add(speciesDefinitionId);
  const guide = await getSpeciesHusbandryGuide(speciesDefinitionId);
  if (!guide) return null;
  if (guide.sourceSpeciesDefinitionId) {
    const source = await getResolvedSpeciesHusbandryGuide(guide.sourceSpeciesDefinitionId, seen);
    return source ? { ...source, linkedThrough: guide } : guide;
  }
  return guide;
}

export async function assertHusbandryLinkAllowed(collectionId: string, speciesDefinitionId: string, sourceSpeciesDefinitionId: string) {
  if (speciesDefinitionId === sourceSpeciesDefinitionId) throw new Error("A species cannot link to its own husbandry guide.");
  await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId }, { collectionId: null }] } });
  await prisma.speciesDefinition.findFirstOrThrow({ where: { id: sourceSpeciesDefinitionId, collectionId } });
  const sourceGuide = await prisma.speciesHusbandryGuide.findFirst({ where: { collectionId, speciesDefinitionId: sourceSpeciesDefinitionId } });
  if (!sourceGuide) throw new Error("The source species needs a husbandry guide before it can be linked.");
  let current: string | null = sourceSpeciesDefinitionId;
  const seen = new Set<string>([speciesDefinitionId]);
  while (current) {
    if (seen.has(current)) throw new Error("This husbandry link would create a cycle.");
    seen.add(current);
    const guide: { sourceSpeciesDefinitionId: string | null } | null = await prisma.speciesHusbandryGuide.findFirst({ where: { collectionId, speciesDefinitionId: current }, select: { sourceSpeciesDefinitionId: true } });
    current = guide?.sourceSpeciesDefinitionId ?? null;
  }
}

export async function saveSpeciesHusbandryGuide(input: {
  collectionId: string;
  speciesDefinitionId: string;
  speciesType: HusbandrySpeciesType;
  summary?: string | null;
  careDifficulty?: string | null;
  sourceNotes?: string | null;
  fields: unknown;
  status?: "LOCAL" | "AI_DRAFT" | "REVIEWED";
}) {
  await prisma.speciesDefinition.findFirstOrThrow({ where: { id: input.speciesDefinitionId, OR: [{ collectionId: input.collectionId }, { collectionId: null }] } });
  const fields = normalizeHusbandryFields(input.speciesType, input.fields);
  return prisma.speciesHusbandryGuide.upsert({
    where: { speciesDefinitionId: input.speciesDefinitionId },
    update: {
      speciesType: input.speciesType as never,
      summary: input.summary,
      careDifficulty: input.careDifficulty,
      sourceNotes: input.sourceNotes,
      status: input.status ?? "LOCAL",
      sourceSpeciesDefinitionId: null,
      fields: fields as never,
      aiReviewedAt: input.status === "REVIEWED" ? new Date() : undefined
    },
    create: {
      collectionId: input.collectionId,
      speciesDefinitionId: input.speciesDefinitionId,
      speciesType: input.speciesType as never,
      summary: input.summary,
      careDifficulty: input.careDifficulty,
      sourceNotes: input.sourceNotes,
      status: input.status ?? "LOCAL",
      fields: fields as never,
      aiReviewedAt: input.status === "REVIEWED" ? new Date() : undefined
    }
  });
}

export async function saveSpeciesHusbandryGuideField(input: {
  collectionId: string;
  speciesDefinitionId: string;
  fieldName: string;
  fieldValue: string | null;
}) {
  const definition = await prisma.speciesDefinition.findFirstOrThrow({ where: { id: input.speciesDefinitionId, OR: [{ collectionId: input.collectionId }, { collectionId: null }] } });
  const existing = await prisma.speciesHusbandryGuide.findUnique({ where: { speciesDefinitionId: input.speciesDefinitionId } });
  if (existing?.sourceSpeciesDefinitionId) throw new Error("Fork the linked husbandry guide before editing local fields.");
  const speciesType = (existing?.speciesType as HusbandrySpeciesType | undefined) ?? inferSpeciesHusbandryType(definition);
  const fields = normalizeHusbandryFields(speciesType, existing?.fields);
  fields[input.fieldName] = input.fieldValue?.trim() || null;
  return saveSpeciesHusbandryGuide({
    collectionId: input.collectionId,
    speciesDefinitionId: input.speciesDefinitionId,
    speciesType,
    summary: existing?.summary,
    careDifficulty: existing?.careDifficulty,
    sourceNotes: existing?.sourceNotes,
    fields
  });
}

export async function linkSpeciesHusbandryGuide(collectionId: string, speciesDefinitionId: string, sourceSpeciesDefinitionId: string, sourceNotes?: string | null) {
  await assertHusbandryLinkAllowed(collectionId, speciesDefinitionId, sourceSpeciesDefinitionId);
  const definition = await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId } });
  return prisma.speciesHusbandryGuide.upsert({
    where: { speciesDefinitionId },
    update: {
      sourceSpeciesDefinitionId,
      status: "LINKED",
      speciesType: inferSpeciesHusbandryType(definition) as never,
      summary: null,
      careDifficulty: null,
      sourceNotes: sourceNotes ?? "Uses live-linked husbandry from another species definition.",
      fields: {}
    },
    create: {
      collectionId,
      speciesDefinitionId,
      sourceSpeciesDefinitionId,
      status: "LINKED",
      speciesType: inferSpeciesHusbandryType(definition) as never,
      sourceNotes: sourceNotes ?? "Uses live-linked husbandry from another species definition.",
      fields: {}
    }
  });
}

export async function forkSpeciesHusbandryGuide(collectionId: string, speciesDefinitionId: string) {
  const guide = await prisma.speciesHusbandryGuide.findFirstOrThrow({ where: { collectionId, speciesDefinitionId } });
  if (!guide.sourceSpeciesDefinitionId) return guide;
  const source = await getResolvedSpeciesHusbandryGuide(guide.sourceSpeciesDefinitionId);
  if (!source) throw new Error("Linked source guide no longer exists.");
  return prisma.speciesHusbandryGuide.update({
    where: { id: guide.id },
    data: {
      sourceSpeciesDefinitionId: null,
      status: "LOCAL",
      speciesType: source.speciesType,
      summary: source.summary,
      careDifficulty: source.careDifficulty,
      sourceNotes: `Forked from linked guide on ${new Date().toISOString().slice(0, 10)}.`,
      fields: normalizeHusbandryFields(source.speciesType, source.fields) as never,
      aiGeneratedAt: source.aiGeneratedAt
    }
  });
}

export async function deleteSpeciesHusbandryGuide(collectionId: string, speciesDefinitionId: string) {
  return prisma.speciesHusbandryGuide.deleteMany({ where: { collectionId, speciesDefinitionId } });
}

export async function saveSpeciesHusbandryOverride(input: {
  collectionId: string;
  aquariumItemId: string;
  fields: unknown;
  overrideNotes?: string | null;
}) {
  const item = await prisma.aquariumItem.findFirstOrThrow({
    where: { id: input.aquariumItemId, collectionId: input.collectionId },
    include: { speciesDefinition: true }
  });
  if (!item.speciesDefinitionId || !item.speciesDefinition) throw new Error("This inventory item is not linked to a species definition.");
  const guide = await getResolvedSpeciesHusbandryGuide(item.speciesDefinitionId);
  const speciesType = (guide?.speciesType as HusbandrySpeciesType | undefined) ?? inferSpeciesHusbandryType(item.speciesDefinition);
  const fields = normalizeHusbandryFields(speciesType, input.fields);
  if (!hasHusbandryData(speciesType, fields) && !input.overrideNotes) {
    await prisma.speciesHusbandryOverride.deleteMany({ where: { collectionId: input.collectionId, aquariumItemId: input.aquariumItemId } });
    return null;
  }
  return prisma.speciesHusbandryOverride.upsert({
    where: { aquariumItemId: input.aquariumItemId },
    update: { speciesDefinitionId: item.speciesDefinitionId, fields: fields as never, overrideNotes: input.overrideNotes },
    create: { collectionId: input.collectionId, aquariumItemId: input.aquariumItemId, speciesDefinitionId: item.speciesDefinitionId, fields: fields as never, overrideNotes: input.overrideNotes }
  });
}

export async function saveSpeciesHusbandryOverrideField(input: {
  collectionId: string;
  aquariumItemId: string;
  fieldName: string;
  fieldValue: string | null;
}) {
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: input.aquariumItemId, collectionId: input.collectionId }, include: { speciesDefinition: true, husbandryOverride: true } });
  if (!item.speciesDefinitionId || !item.speciesDefinition) throw new Error("This inventory item is not linked to a species definition.");
  const guide = await getResolvedSpeciesHusbandryGuide(item.speciesDefinitionId);
  const speciesType = (guide?.speciesType as HusbandrySpeciesType | undefined) ?? inferSpeciesHusbandryType(item.speciesDefinition);
  const fields = normalizeHusbandryFields(speciesType, item.husbandryOverride?.fields);
  fields[input.fieldName] = input.fieldValue?.trim() || null;
  return saveSpeciesHusbandryOverride({ collectionId: input.collectionId, aquariumItemId: input.aquariumItemId, fields, overrideNotes: item.husbandryOverride?.overrideNotes });
}

export async function deleteSpeciesHusbandryOverrideIfEmpty(collectionId: string, aquariumItemId: string) {
  const override = await prisma.speciesHusbandryOverride.findFirst({ where: { collectionId, aquariumItemId }, include: { speciesDefinition: true } });
  if (!override) return null;
  const speciesType = inferSpeciesHusbandryType(override.speciesDefinition);
  if (!hasHusbandryData(speciesType, override.fields) && !override.overrideNotes) {
    return prisma.speciesHusbandryOverride.delete({ where: { id: override.id } });
  }
  return override;
}

export async function getEffectiveHusbandryForItem(aquariumItemId: string) {
  const item = await prisma.aquariumItem.findUnique({ where: { id: aquariumItemId }, include: { speciesDefinition: true, husbandryOverride: true } });
  if (!item?.speciesDefinitionId || !item.speciesDefinition) return null;
  const guide = await getResolvedSpeciesHusbandryGuide(item.speciesDefinitionId);
  const speciesType = (guide?.speciesType as HusbandrySpeciesType | undefined) ?? inferSpeciesHusbandryType(item.speciesDefinition);
  const baseFields = normalizeHusbandryFields(speciesType, guide?.fields);
  const overrideFields = normalizeHusbandryFields(speciesType, item.husbandryOverride?.fields);
  const fields = mergeHusbandryValues(speciesType, baseFields, overrideFields);
  if (guide?.careDifficulty) fields.careDifficulty = guide.careDifficulty;
  return {
    speciesType,
    guide,
    override: item.husbandryOverride,
    fields
  };
}

export function suggestFeedingCadenceFromHusbandry(type: HusbandrySpeciesType, fields: unknown) {
  const values = normalizeHusbandryFields(type, fields);
  return values.feedingFrequency ?? (type === "PLANT" || type === "CORAL" ? null : "Observe appetite and feed according to species needs.");
}

export function suggestPlantTrimCadenceFromHusbandry(type: HusbandrySpeciesType, fields: unknown) {
  if (type !== "PLANT") return null;
  const values = normalizeHusbandryFields(type, fields);
  if (/fast/i.test(values.growthRate ?? "")) return "Consider weekly trimming during active growth.";
  if (/slow/i.test(values.growthRate ?? "")) return "Trim only when older leaves or layout goals require it.";
  return "Review growth during routine maintenance.";
}

export function suggestQuarantineNotesFromHusbandry(type: HusbandrySpeciesType, fields: unknown) {
  const values = normalizeHusbandryFields(type, fields);
  return values.quarantineNotes ?? values.medicationSensitivity ?? values.commonIssues ?? null;
}

export function husbandryFormDataForGuide(type: HusbandrySpeciesType, formData: FormData) {
  return parseHusbandryFormData(type, formData);
}
