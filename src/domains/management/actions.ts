"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/domains/audit/audit-log";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : Number(value);
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : new Date(value);
}

async function getCollection() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  return { user, collection };
}

export async function createSpecies(formData: FormData) {
  const { user } = await getCollection();
  const species = await prisma.speciesDefinition.create({
    data: {
      category: String(formData.get("category") ?? "OTHER") as never,
      commonName: text(formData, "commonName") ?? "Unnamed species",
      scientificName: text(formData, "scientificName"),
      genus: text(formData, "genus"),
      species: text(formData, "species"),
      variety: text(formData, "variety"),
      cultivar: text(formData, "cultivar"),
      careNotes: text(formData, "careNotes"),
      tempMin: numberValue(formData, "tempMin"),
      tempMax: numberValue(formData, "tempMax"),
      phMin: numberValue(formData, "phMin"),
      phMax: numberValue(formData, "phMax"),
      ghMin: numberValue(formData, "ghMin"),
      ghMax: numberValue(formData, "ghMax"),
      khMin: numberValue(formData, "khMin"),
      khMax: numberValue(formData, "khMax"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "SpeciesDefinition", entityId: species.id, action: "CREATE", after: species, createdById: user.id });
  revalidatePath("/species");
}

export async function updateSpecies(formData: FormData) {
  const { user } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.speciesDefinition.findUniqueOrThrow({ where: { id } });
  const species = await prisma.speciesDefinition.update({
    where: { id },
    data: {
      category: String(formData.get("category") ?? "OTHER") as never,
      commonName: text(formData, "commonName") ?? "Unnamed species",
      scientificName: text(formData, "scientificName"),
      genus: text(formData, "genus"),
      species: text(formData, "species"),
      variety: text(formData, "variety"),
      cultivar: text(formData, "cultivar"),
      careNotes: text(formData, "careNotes"),
      tempMin: numberValue(formData, "tempMin"),
      tempMax: numberValue(formData, "tempMax"),
      phMin: numberValue(formData, "phMin"),
      phMax: numberValue(formData, "phMax"),
      ghMin: numberValue(formData, "ghMin"),
      ghMax: numberValue(formData, "ghMax"),
      khMin: numberValue(formData, "khMin"),
      khMax: numberValue(formData, "khMax"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "SpeciesDefinition", entityId: species.id, action: "UPDATE", before, after: species, createdById: user.id });
  revalidatePath("/species");
}

export async function deleteSpecies(formData: FormData) {
  const { user } = await getCollection();
  const id = String(formData.get("id"));
  const used = await prisma.aquariumItem.count({ where: { speciesDefinitionId: id } });
  if (used > 0) throw new Error("This species is used by inventory records and cannot be deleted yet.");
  const before = await prisma.speciesDefinition.delete({ where: { id } });
  await writeAuditLog({ entityType: "SpeciesDefinition", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/species");
}

export async function createItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemType = String(formData.get("itemType") ?? "OTHER");
  const item = await prisma.aquariumItem.create({
    data: {
      collectionId: collection.id,
      itemType: itemType as never,
      aquariumId: text(formData, "aquariumId"),
      speciesDefinitionId: text(formData, "speciesDefinitionId"),
      name: text(formData, "name") ?? "Unnamed item",
      description: text(formData, "description"),
      quantity: numberValue(formData, "quantity") ?? 1,
      unit: text(formData, "unit"),
      status: String(formData.get("status") ?? "ACTIVE") as never,
      acquiredFrom: text(formData, "acquiredFrom"),
      acquiredAt: dateValue(formData, "acquiredAt"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "AquariumItem", entityId: item.id, action: "CREATE", after: item, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function updateItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.aquariumItem.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const item = await prisma.aquariumItem.update({
    where: { id },
    data: {
      itemType: String(formData.get("itemType") ?? before.itemType) as never,
      aquariumId: text(formData, "aquariumId"),
      speciesDefinitionId: text(formData, "speciesDefinitionId"),
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      quantity: numberValue(formData, "quantity") ?? before.quantity,
      unit: text(formData, "unit"),
      status: String(formData.get("status") ?? before.status) as never,
      acquiredFrom: text(formData, "acquiredFrom"),
      acquiredAt: dateValue(formData, "acquiredAt"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "AquariumItem", entityId: id, action: "UPDATE", before, after: item, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function archiveItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.aquariumItem.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const item = await prisma.aquariumItem.update({ where: { id }, data: { status: "ARCHIVED" } });
  await writeAuditLog({ entityType: "AquariumItem", entityId: id, action: "ARCHIVE", before, after: item, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/equipment");
  revalidatePath("/dashboard");
}

export async function transferItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const toAquariumId = text(formData, "toAquariumId");
  const quantity = numberValue(formData, "quantity") ?? 1;
  const reason = text(formData, "reason");
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id } });
  const fullTransfer = quantity >= item.quantity;

  const transfer = await prisma.itemTransfer.create({
    data: {
      itemId,
      fromAquariumId: item.aquariumId,
      toAquariumId,
      quantity,
      reason,
      createdById: user.id
    }
  });

  if (fullTransfer) {
    await prisma.aquariumItem.update({ where: { id: itemId }, data: { aquariumId: toAquariumId, status: "ACTIVE" } });
  } else {
    await prisma.aquariumItem.update({ where: { id: itemId }, data: { quantity: item.quantity - quantity } });
    await prisma.aquariumItem.create({
      data: {
        collectionId: collection.id,
        aquariumId: toAquariumId,
        itemType: item.itemType,
        speciesDefinitionId: item.speciesDefinitionId,
        name: item.name,
        description: item.description,
        quantity,
        unit: item.unit,
        status: "ACTIVE",
        acquiredFrom: item.acquiredFrom,
        acquiredAt: item.acquiredAt,
        notes: item.notes
      }
    });
  }

  for (const aquariumId of [item.aquariumId, toAquariumId].filter(Boolean) as string[]) {
    await prisma.aquariumEvent.create({
      data: {
        aquariumId,
        eventType: "TRANSFER",
        title: `Transferred ${item.name}`,
        summary: reason,
        createdById: user.id
      }
    });
  }

  await writeAuditLog({ entityType: "AquariumItem", entityId: itemId, action: "TRANSFER", before: item, after: transfer, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function createEquipment(formData: FormData) {
  const { user, collection } = await getCollection();
  const item = await prisma.aquariumItem.create({
    data: {
      collectionId: collection.id,
      aquariumId: text(formData, "aquariumId"),
      itemType: "EQUIPMENT",
      name: text(formData, "name") ?? "Unnamed equipment",
      quantity: 1,
      notes: text(formData, "notes"),
      equipmentProfile: {
        create: {
          equipmentType: String(formData.get("equipmentType") ?? "OTHER") as never,
          brand: text(formData, "brand"),
          model: text(formData, "model"),
          serialNumber: text(formData, "serialNumber"),
          purchaseDate: dateValue(formData, "purchaseDate"),
          warrantyUntil: dateValue(formData, "warrantyUntil"),
          maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
          lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
          notes: text(formData, "profileNotes")
        }
      }
    }
  });
  await writeAuditLog({ entityType: "EquipmentProfile", entityId: item.id, action: "CREATE", after: item, createdById: user.id });
  revalidatePath("/equipment");
  revalidatePath("/inventory");
}

export async function updateEquipment(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const before = await prisma.aquariumItem.findFirstOrThrow({
    where: { id: itemId, collectionId: collection.id, itemType: "EQUIPMENT" },
    include: { equipmentProfile: true }
  });
  const item = await prisma.aquariumItem.update({
    where: { id: itemId },
    data: {
      name: text(formData, "name") ?? before.name,
      aquariumId: text(formData, "aquariumId"),
      notes: text(formData, "notes"),
      equipmentProfile: {
        upsert: {
          create: {
            equipmentType: String(formData.get("equipmentType") ?? "OTHER") as never,
            brand: text(formData, "brand"),
            model: text(formData, "model"),
            serialNumber: text(formData, "serialNumber"),
            purchaseDate: dateValue(formData, "purchaseDate"),
            warrantyUntil: dateValue(formData, "warrantyUntil"),
            maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
            lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
            notes: text(formData, "profileNotes")
          },
          update: {
            equipmentType: String(formData.get("equipmentType") ?? "OTHER") as never,
            brand: text(formData, "brand"),
            model: text(formData, "model"),
            serialNumber: text(formData, "serialNumber"),
            purchaseDate: dateValue(formData, "purchaseDate"),
            warrantyUntil: dateValue(formData, "warrantyUntil"),
            maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
            lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
            notes: text(formData, "profileNotes")
          }
        }
      }
    },
    include: { equipmentProfile: true }
  });
  await writeAuditLog({ entityType: "EquipmentProfile", entityId: itemId, action: "UPDATE", before, after: item, createdById: user.id });
  revalidatePath("/equipment");
  revalidatePath("/inventory");
}

export async function markEquipmentMaintained(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id }, include: { equipmentProfile: true } });
  const profile = await prisma.equipmentProfile.update({
    where: { itemId },
    data: { lastMaintainedAt: new Date() }
  });
  if (item.aquariumId) {
    await prisma.aquariumEvent.create({
      data: {
        aquariumId: item.aquariumId,
        eventType: "MAINTENANCE",
        title: `Maintained ${item.name}`,
        createdById: user.id
      }
    });
  }
  await writeAuditLog({ entityType: "EquipmentProfile", entityId: profile.id, action: "MARK_MAINTAINED", before: item.equipmentProfile, after: profile, createdById: user.id });
  revalidatePath("/equipment");
}

export async function createAquariumEvent(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const eventType = String(formData.get("eventType") ?? "NOTE");
  const event = await prisma.aquariumEvent.create({
    data: {
      aquariumId,
      eventType: eventType as never,
      title: text(formData, "title") ?? eventType,
      summary: text(formData, "summary"),
      notes: text(formData, "notes"),
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

  await writeAuditLog({ entityType: "AquariumEvent", entityId: event.id, action: "CREATE", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createReading(formData: FormData) {
  const { user, collection } = await getCollection();
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
  await writeAuditLog({ entityType: "WaterParameterReading", entityId: reading.id, action: "CREATE", after: reading, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function startWorkflow(formData: FormData) {
  const { collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const workflowTemplateId = String(formData.get("workflowTemplateId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const template = await prisma.workflowTemplate.findUniqueOrThrow({ where: { id: workflowTemplateId }, include: { steps: true } });
  await prisma.workflowRun.create({
    data: {
      aquariumId,
      workflowTemplateId,
      stepRuns: {
        create: template.steps.map((step) => ({ workflowStepId: step.id }))
      }
    }
  });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/workflows");
}

export async function completeWorkflowStep(formData: FormData) {
  const id = String(formData.get("id"));
  const step = await prisma.workflowStepRun.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
    include: { workflowRun: true }
  });
  const remaining = await prisma.workflowStepRun.count({
    where: { workflowRunId: step.workflowRunId, status: { not: "COMPLETED" } }
  });
  if (remaining === 0) {
    await prisma.workflowRun.update({ where: { id: step.workflowRunId }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
  revalidatePath(`/aquariums/${step.workflowRun.aquariumId}`);
}

export async function generateQrCode(formData: FormData) {
  const { user } = await getCollection();
  const entityType = String(formData.get("entityType"));
  const entityId = String(formData.get("entityId"));
  const label = text(formData, "label") ?? `${entityType} ${entityId}`;
  const payload = JSON.stringify({ app: "fluxpoint", entityType, entityId, version: 1 });
  const qr = await prisma.qrCode.create({ data: { entityType, entityId, label, payload } });
  await writeAuditLog({ entityType, entityId, action: "GENERATE_QR", after: qr, createdById: user.id });
  revalidatePath("/aquariums");
  revalidatePath("/equipment");
}
