import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { AquariumPlanWorkspace } from "@/components/aquarium-plans/AquariumPlanWorkspace";
import { getAquariumPlanWorkspace } from "@/domains/aquarium-plans/queries";
import { buildLocationPath } from "@/lib/format/location";

export const dynamic = "force-dynamic";

export default async function AquariumPlanPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { id, planId } = await params;
  const workspace = await getAquariumPlanWorkspace(planId, collection.id);
  if (!workspace || workspace.plan.aquariumId !== id) notFound();
  const [speciesDefinitions, inventoryItems, equipmentItems, workflowTemplates, waterSources, waterRecipes] = await Promise.all([
    prisma.speciesDefinition.findMany({
      where: { OR: [{ collectionId: collection.id }, { collectionId: null }] },
      include: { variants: { where: { collectionId: collection.id, archivedAt: null }, orderBy: [{ variantType: "asc" }, { name: "asc" }] } },
      orderBy: [{ category: "asc" }, { commonName: "asc" }]
    }),
    prisma.aquariumItem.findMany({
      where: { collectionId: collection.id, status: { notIn: ["ARCHIVED", "CONSUMED", "DEAD", "REMOVED"] } },
      include: { equipmentProfile: true, aquarium: true, storageLocation: { include: { parent: true } }, speciesDefinition: true, speciesVariant: true },
      orderBy: [{ itemType: "asc" }, { name: "asc" }]
    }),
    prisma.aquariumItem.findMany({
      where: { collectionId: collection.id, itemType: { in: ["EQUIPMENT", "SUBSTRATE"] }, status: { notIn: ["ARCHIVED", "CONSUMED", "DEAD", "REMOVED"] } },
      include: { equipmentProfile: true, aquarium: true, storageLocation: { include: { parent: true } } },
      orderBy: { name: "asc" }
    }),
    prisma.workflowTemplate.findMany({ where: { status: "ACTIVE", OR: [{ collectionId: collection.id }, { collectionId: null }] }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
    prisma.waterSource.findMany({ where: { collectionId: collection.id, archivedAt: null }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.waterRecipe.findMany({ where: { collectionId: collection.id, isActive: true }, include: { waterSource: true }, orderBy: { name: "asc" } })
  ]);
  const speciesOptions = speciesDefinitions.map((definition) => ({
    id: definition.id,
    label: `${definition.commonName}${definition.scientificName ? ` · ${definition.scientificName}` : ""} · ${definition.category.toLowerCase()}`,
    category: definition.category,
    variants: definition.variants.map((variant) => ({ id: variant.id, label: variant.displayName ?? variant.name }))
  }));
  const variantOptions = speciesDefinitions.flatMap((definition) => definition.variants.map((variant) => ({
    id: variant.id,
    label: `${definition.commonName} · ${variant.displayName ?? variant.name}`
  })));
  const inventoryOptions = inventoryItems.map((item) => ({
    id: item.id,
    label: [item.name, item.itemType.toLowerCase(), item.aquarium?.name ?? (item.storageLocation ? buildLocationPath(item.storageLocation) : null) ?? "unplaced"].filter(Boolean).join(" · "),
    itemType: item.itemType,
    equipmentType: item.equipmentProfile?.equipmentType ?? null
  }));
  const equipmentOptions = equipmentItems.map((item) => ({
    id: item.id,
    label: [item.name, item.equipmentProfile?.equipmentType ?? item.itemType.toLowerCase(), item.aquarium?.name ?? (item.storageLocation ? buildLocationPath(item.storageLocation) : null) ?? "unplaced"].filter(Boolean).join(" · "),
    itemType: item.itemType,
    equipmentType: item.equipmentProfile?.equipmentType ?? null
  }));
  const workflowOptions = workflowTemplates.map((template) => ({ id: template.id, label: `${template.name} · ${template.category.toLowerCase()}` }));
  const waterSourceOptions = waterSources.map((source) => ({ id: source.id, label: `${source.name} · ${source.sourceType.toLowerCase()}` }));
  const waterRecipeOptions = waterRecipes.map((recipe) => ({ id: recipe.id, label: `${recipe.name}${recipe.waterSource ? ` · ${recipe.waterSource.name}` : ""}` }));

  return (
    <div className="space-y-5">
      <PageHeader title="Tank Planning" eyebrow={workspace.plan.aquarium.name} />
      <AquariumPlanWorkspace
        plan={workspace.plan}
        progress={workspace.progress}
        speciesOptions={speciesOptions}
        variantOptions={variantOptions}
        inventoryOptions={inventoryOptions}
        equipmentOptions={equipmentOptions}
        workflowOptions={workflowOptions}
        waterSourceOptions={waterSourceOptions}
        waterRecipeOptions={waterRecipeOptions}
      />
    </div>
  );
}
