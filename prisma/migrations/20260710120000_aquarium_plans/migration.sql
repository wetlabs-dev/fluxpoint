-- Tank Planning and Revision system
CREATE TYPE "AquariumPlanType" AS ENUM ('INITIAL_SETUP', 'REVISION');
CREATE TYPE "AquariumPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'READY_TO_COMPLETE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "AquariumPlanItemType" AS ENUM (
  'TASK',
  'LIVESTOCK_ADD',
  'PLANT_ADD',
  'ORGANISM_ADD',
  'INVENTORY_ASSIGN',
  'EQUIPMENT_ADD',
  'EQUIPMENT_ATTACH',
  'EQUIPMENT_REMOVE',
  'EQUIPMENT_REPLACE',
  'HARDSCAPE_ADD',
  'HARDSCAPE_REMOVE',
  'SUBSTRATE_ADD',
  'SUBSTRATE_REMOVE',
  'INVENTORY_REMOVE',
  'WATER_TARGET_CHANGE',
  'AQUARIUM_PROFILE_CHANGE',
  'WATER_SOURCE_CHANGE',
  'WATER_RECIPE_CHANGE',
  'LIGHTING_SCHEDULE_CHANGE',
  'MAINTENANCE',
  'WORKFLOW',
  'PHOTO',
  'OTHER'
);
CREATE TYPE "AquariumPlanItemStatus" AS ENUM ('PLANNED', 'READY', 'BLOCKED', 'IN_PROGRESS', 'IMPLEMENTED', 'SKIPPED', 'CANCELLED', 'FAILED');
CREATE TYPE "AquariumPlanPurchaseStatus" AS ENUM ('NOT_NEEDED', 'TO_PURCHASE', 'ORDERED', 'ACQUIRED');

CREATE TABLE "AquariumPlan" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "planType" "AquariumPlanType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "AquariumPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3),
  "targetCompletionDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "completedByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AquariumPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AquariumPlanItem" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumPlanId" TEXT NOT NULL,
  "itemType" "AquariumPlanItemType" NOT NULL,
  "category" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "status" "AquariumPlanItemStatus" NOT NULL DEFAULT 'PLANNED',
  "plannedQuantity" DECIMAL(12,3),
  "plannedUnit" TEXT,
  "targetSpeciesDefinitionId" TEXT,
  "targetSpeciesVariantId" TEXT,
  "targetInventoryItemId" TEXT,
  "targetEquipmentItemId" TEXT,
  "replacementInventoryItemId" TEXT,
  "sourceInventoryItemId" TEXT,
  "targetWorkflowTemplateId" TEXT,
  "payload" JSONB,
  "implementationResult" JSONB,
  "implementationError" TEXT,
  "implementedAt" TIMESTAMP(3),
  "implementedByUserId" TEXT,
  "skippedAt" TIMESTAMP(3),
  "skipReason" TEXT,
  "estimatedUnitCost" DECIMAL(10,2),
  "estimatedTotalCost" DECIMAL(10,2),
  "actualCost" DECIMAL(10,2),
  "vendor" TEXT,
  "purchaseStatus" "AquariumPlanPurchaseStatus" NOT NULL DEFAULT 'NOT_NEEDED',
  "logToTimeline" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AquariumPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AquariumPlanItemDependency" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "planItemId" TEXT NOT NULL,
  "dependsOnPlanItemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AquariumPlanItemDependency_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AquariumPlan_collectionId_status_idx" ON "AquariumPlan"("collectionId", "status");
CREATE INDEX "AquariumPlan_aquariumId_planType_status_idx" ON "AquariumPlan"("aquariumId", "planType", "status");
CREATE INDEX "AquariumPlanItem_collectionId_status_idx" ON "AquariumPlanItem"("collectionId", "status");
CREATE INDEX "AquariumPlanItem_aquariumPlanId_sortOrder_idx" ON "AquariumPlanItem"("aquariumPlanId", "sortOrder");
CREATE INDEX "AquariumPlanItem_targetSpeciesDefinitionId_idx" ON "AquariumPlanItem"("targetSpeciesDefinitionId");
CREATE INDEX "AquariumPlanItem_targetInventoryItemId_idx" ON "AquariumPlanItem"("targetInventoryItemId");
CREATE INDEX "AquariumPlanItem_targetEquipmentItemId_idx" ON "AquariumPlanItem"("targetEquipmentItemId");
CREATE UNIQUE INDEX "AquariumPlanItemDependency_planItemId_dependsOnPlanItemId_key" ON "AquariumPlanItemDependency"("planItemId", "dependsOnPlanItemId");
CREATE INDEX "AquariumPlanItemDependency_collectionId_idx" ON "AquariumPlanItemDependency"("collectionId");
CREATE INDEX "AquariumPlanItemDependency_dependsOnPlanItemId_idx" ON "AquariumPlanItemDependency"("dependsOnPlanItemId");

ALTER TABLE "AquariumPlan" ADD CONSTRAINT "AquariumPlan_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumPlan" ADD CONSTRAINT "AquariumPlan_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumPlan" ADD CONSTRAINT "AquariumPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumPlan" ADD CONSTRAINT "AquariumPlan_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_aquariumPlanId_fkey" FOREIGN KEY ("aquariumPlanId") REFERENCES "AquariumPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_targetSpeciesDefinitionId_fkey" FOREIGN KEY ("targetSpeciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_targetSpeciesVariantId_fkey" FOREIGN KEY ("targetSpeciesVariantId") REFERENCES "SpeciesVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_targetInventoryItemId_fkey" FOREIGN KEY ("targetInventoryItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_targetEquipmentItemId_fkey" FOREIGN KEY ("targetEquipmentItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_replacementInventoryItemId_fkey" FOREIGN KEY ("replacementInventoryItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_sourceInventoryItemId_fkey" FOREIGN KEY ("sourceInventoryItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_targetWorkflowTemplateId_fkey" FOREIGN KEY ("targetWorkflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItem" ADD CONSTRAINT "AquariumPlanItem_implementedByUserId_fkey" FOREIGN KEY ("implementedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AquariumPlanItemDependency" ADD CONSTRAINT "AquariumPlanItemDependency_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItemDependency" ADD CONSTRAINT "AquariumPlanItemDependency_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "AquariumPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumPlanItemDependency" ADD CONSTRAINT "AquariumPlanItemDependency_dependsOnPlanItemId_fkey" FOREIGN KEY ("dependsOnPlanItemId") REFERENCES "AquariumPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
