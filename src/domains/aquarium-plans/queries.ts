import { prisma } from "@/lib/db/prisma";
import { calculateAquariumPlanProgress } from "@/domains/aquarium-plans/progress";
import type { AquariumItemStatus, Prisma } from "@prisma/client";

const activeItemStatuses: AquariumItemStatus[] = ["ACTIVE", "IN_AQUARIUM", "IN_STORAGE", "IN_QUARANTINE"];

export const planIncludes = {
  aquarium: {
    include: {
      profile: true,
      waterSource: true,
      waterRecipe: true,
      items: { where: { status: { in: activeItemStatuses } }, include: { speciesDefinition: true, speciesVariant: true, equipmentProfile: true } },
      equipmentAttachments: { include: { item: { include: { equipmentProfile: true } } } }
    }
  },
  items: {
    include: {
      targetSpeciesDefinition: true,
      targetSpeciesVariant: true,
      targetInventoryItem: true,
      targetEquipmentItem: { include: { equipmentProfile: true } },
      replacementInventoryItem: true,
      sourceInventoryItem: true,
      targetWorkflowTemplate: true,
      dependencies: { include: { dependsOnPlanItem: true } },
      dependents: true
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  },
  createdBy: { select: { id: true, name: true, email: true } },
  completedBy: { select: { id: true, name: true, email: true } }
} satisfies Prisma.AquariumPlanInclude;

export async function ensureInitialSetupPlan(aquariumId: string, collectionId: string, userId?: string) {
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId } });
  if (aquarium.status !== "PLANNING") return null;
  const existing = await prisma.aquariumPlan.findFirst({
    where: { aquariumId, collectionId, planType: "INITIAL_SETUP", status: { notIn: ["CANCELLED", "ARCHIVED"] } },
    orderBy: { createdAt: "asc" }
  });
  if (existing) return existing;
  return prisma.aquariumPlan.create({
    data: {
      collectionId,
      aquariumId,
      planType: "INITIAL_SETUP",
      status: "ACTIVE",
      title: `${aquarium.name} setup plan`,
      description: "Staging workspace for everything this aquarium needs before activation.",
      startedAt: new Date(),
      createdByUserId: userId ?? null,
      items: {
        create: defaultSetupItems(collectionId)
      }
    }
  });
}

export async function getAquariumPlanWorkspace(planId: string, collectionId: string) {
  const plan = await prisma.aquariumPlan.findFirst({
    where: { id: planId, collectionId },
    include: planIncludes
  });
  if (!plan) return null;
  const progress = calculateAquariumPlanProgress(plan.items);
  return { plan, progress };
}

export async function getCurrentOrInitialPlan(aquariumId: string, collectionId: string, userId?: string) {
  await ensureInitialSetupPlan(aquariumId, collectionId, userId);
  return prisma.aquariumPlan.findFirst({
    where: {
      aquariumId,
      collectionId,
      status: { in: ["ACTIVE", "DRAFT", "PAUSED", "READY_TO_COMPLETE"] }
    },
    include: planIncludes,
    orderBy: [{ planType: "asc" }, { updatedAt: "desc" }]
  });
}

export async function getActivePlanSummaryForAquariums(collectionId: string, aquariumIds: string[]) {
  if (!aquariumIds.length) return new Map<string, { id: string; title: string; planType: string; percent: number; requiredRemaining: number; targetCompletionDate: Date | null; status: string }>();
  const plans = await prisma.aquariumPlan.findMany({
    where: { collectionId, aquariumId: { in: aquariumIds }, status: { in: ["ACTIVE", "DRAFT", "PAUSED", "READY_TO_COMPLETE"] } },
    include: { items: true },
    orderBy: [{ updatedAt: "desc" }]
  });
  const map = new Map<string, { id: string; title: string; planType: string; percent: number; requiredRemaining: number; targetCompletionDate: Date | null; status: string }>();
  for (const plan of plans) {
    if (map.has(plan.aquariumId)) continue;
    const progress = calculateAquariumPlanProgress(plan.items);
    map.set(plan.aquariumId, {
      id: plan.id,
      title: plan.title,
      planType: plan.planType,
      percent: progress.percent,
      requiredRemaining: progress.requiredRemaining,
      targetCompletionDate: plan.targetCompletionDate,
      status: plan.status
    });
  }
  return map;
}

function defaultSetupItems(collectionId: string) {
  const now = new Date();
  return [
    ["Identity and physical setup", "Confirm the vessel, stand, location, and volume."],
    ["Substrate and hardscape", "Install substrate, hardscape, and any deliberately unstructured contents."],
    ["Filtration and circulation", "Attach and test filtration, pump, or aeration equipment."],
    ["Water source and target profile", "Confirm source water, recipe, salinity, and target parameter ranges."],
    ["Cycle tank", "Run cycling workflow or record cycling evidence before livestock."],
    ["Final verification", "Confirm temperature stability, ammonia/nitrite, equipment operation, and readiness."],
    ["Activation review", "Review unresolved optional work, then activate the aquarium."]
  ].map(([title, description], index) => ({
    collectionId,
    itemType: "TASK" as const,
    category: index < 4 ? "Setup" : "Readiness",
    title,
    description,
    sortOrder: index * 10,
    isRequired: true,
    status: index === 0 ? "READY" as const : "PLANNED" as const,
    createdAt: now,
    updatedAt: now
  }));
}
