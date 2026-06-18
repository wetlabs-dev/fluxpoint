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
      scientificName: buildScientificNameFromForm(formData),
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
      scientificName: buildScientificNameFromForm(formData),
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
      sourceId: text(formData, "sourceId"),
      name: text(formData, "name") ?? "Unnamed item",
      description: text(formData, "description"),
      quantity: numberValue(formData, "quantity") ?? 1,
      unit: text(formData, "unit"),
      status: String(formData.get("status") ?? "ACTIVE") as never,
      acquiredFrom: text(formData, "acquiredFrom"),
      purchasePrice: decimalString(formData, "purchasePrice"),
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
      sourceId: text(formData, "sourceId"),
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      quantity: numberValue(formData, "quantity") ?? before.quantity,
      unit: text(formData, "unit"),
      status: String(formData.get("status") ?? before.status) as never,
      acquiredFrom: text(formData, "acquiredFrom"),
      purchasePrice: decimalString(formData, "purchasePrice"),
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
        sourceId: item.sourceId,
        name: item.name,
        description: item.description,
        quantity,
        unit: item.unit,
        status: "ACTIVE",
        acquiredFrom: item.acquiredFrom,
        purchasePrice: item.purchasePrice,
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
        relatedItemId: itemId,
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
      sourceId: text(formData, "sourceId"),
      purchasePrice: decimalString(formData, "purchasePrice"),
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
      sourceId: text(formData, "sourceId"),
      purchasePrice: decimalString(formData, "purchasePrice"),
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
  await writeAuditLog({ entityType: "Location", entityId: location.id, action: "CREATE", after: location, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/aquariums");
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
  await writeAuditLog({ entityType: "Source", entityId: source.id, action: "CREATE", after: source, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
}

export async function createAquariumEvent(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const eventType = String(formData.get("eventType") ?? "NOTE");
  const relatedItemId = text(formData, "relatedItemId");
  if (relatedItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: relatedItemId, collectionId: collection.id } });
  }
  const event = await prisma.aquariumEvent.create({
    data: {
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

  await writeAuditLog({ entityType: "AquariumEvent", entityId: event.id, action: "CREATE", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createMaintenanceEvent(formData: FormData) {
  formData.set("eventType", "MAINTENANCE");
  formData.set("title", text(formData, "title") ?? `Maintenance: ${text(formData, "maintenanceType") ?? "Other"}`);
  await createAquariumEvent(formData);
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

export async function createReadingsBatch(formData: FormData) {
  const { user, collection } = await getCollection();
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
    await prisma.waterParameterReading.createMany({ data });
    await prisma.aquariumEvent.create({
      data: {
        aquariumId,
        eventType: "TEST_RESULT",
        title: `Logged ${data.length} parameter reading${data.length === 1 ? "" : "s"}`,
        summary: data.map((reading) => `${reading.parameter}: ${reading.value}${reading.unit}`).join(", "),
        notes,
        eventDate: measuredAt,
        createdById: user.id
      }
    });
  }

  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const name = text(formData, "name") ?? "Unnamed schedule";
  const schedule = await prisma.lightingSchedule.create({
    data: {
      collectionId: collection.id,
      name,
      description: text(formData, "description"),
      points: {
        create: [
          {
            timeOfDay: text(formData, "startTime") ?? "10:00",
            white: numberValue(formData, "startWhite") ?? 20,
            red: numberValue(formData, "startRed") ?? 10,
            green: numberValue(formData, "startGreen") ?? 10,
            blue: numberValue(formData, "startBlue") ?? 20,
            intensity: numberValue(formData, "startIntensity") ?? 35,
            sortOrder: 10
          },
          {
            timeOfDay: text(formData, "peakTime") ?? "14:00",
            white: numberValue(formData, "peakWhite") ?? 70,
            red: numberValue(formData, "peakRed") ?? 35,
            green: numberValue(formData, "peakGreen") ?? 40,
            blue: numberValue(formData, "peakBlue") ?? 70,
            intensity: numberValue(formData, "peakIntensity") ?? 80,
            sortOrder: 20
          },
          {
            timeOfDay: text(formData, "endTime") ?? "20:00",
            white: 0,
            red: 0,
            green: 0,
            blue: 0,
            intensity: 0,
            sortOrder: 30
          }
        ]
      }
    },
    include: { points: true }
  });
  await writeAuditLog({ entityType: "LightingSchedule", entityId: schedule.id, action: "CREATE", after: schedule, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/aquariums");
}

export async function assignLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const equipmentItemId = text(formData, "equipmentItemId");
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  if (equipmentItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: equipmentItemId, collectionId: collection.id, itemType: "EQUIPMENT" } });
  }
  const assignment = await prisma.aquariumLightingAssignment.upsert({
    where: { aquariumId },
    create: {
      aquariumId,
      equipmentItemId,
      scheduleId: text(formData, "scheduleId"),
      notes: text(formData, "lightingAssignmentNotes")
    },
    update: {
      equipmentItemId,
      scheduleId: text(formData, "scheduleId"),
      notes: text(formData, "lightingAssignmentNotes")
    },
    include: { schedule: true, equipmentItem: true }
  });
  await writeAuditLog({ entityType: "AquariumLightingAssignment", entityId: assignment.id, action: "UPSERT", after: assignment, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/settings");
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
  const lowerType = entityType.toLowerCase();
  const payload = lowerType === "aquarium"
    ? `fluxpoint://aquarium/${entityId}`
    : lowerType === "aquariumitem" || lowerType === "item"
      ? `fluxpoint://item/${entityId}`
      : `fluxpoint://${lowerType}/${entityId}`;
  const qr = await prisma.qrCode.create({ data: { entityType, entityId, label, payload } });
  await writeAuditLog({ entityType, entityId, action: "GENERATE_QR", after: qr, createdById: user.id });
  revalidatePath("/aquariums");
  revalidatePath("/equipment");
}
