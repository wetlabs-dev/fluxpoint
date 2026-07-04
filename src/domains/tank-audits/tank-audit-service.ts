import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ItemType, Prisma, TankAuditLineStatus, TankAuditObservedPlacementAction } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { defaultUnitForItemType } from "@/domains/inventory/quantity";
import { formatFishSexBreakdown, normalizeFishSexCounts } from "@/domains/inventory/fish-sex";

const openStatuses = ["OPEN", "IN_PROGRESS"] as const;
const biologicalTypes = new Set(["FISH", "INVERT", "PLANT"]);

export function canEditTankAudit(role: string | null) {
  return role === "COLLECTION_OWNER" || role === "AQUARIST" || role === "FISHKEEPER";
}

export function canFinalizeTankAudit(role: string | null) {
  return role === "COLLECTION_OWNER" || role === "AQUARIST";
}

export function canCancelTankAudit(role: string | null) {
  return role === "COLLECTION_OWNER";
}

export function auditGroupForItemType(itemType: string) {
  if (itemType === "FISH") return "Fish";
  if (itemType === "INVERT") return "Invertebrates";
  if (itemType === "PLANT") return "Plants";
  if (itemType === "EQUIPMENT") return "Equipment";
  if (itemType === "SUBSTRATE" || itemType === "HARDSCAPE") return "Hardscape / Substrate";
  return "Other";
}

export function activeAuditWhere(collectionId: string, aquariumId: string) {
  return { collectionId, aquariumId, status: { in: openStatuses.slice() } };
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function roundQuantity(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value * 100) / 100);
}

function lineActionForStatus(status: TankAuditLineStatus): TankAuditObservedPlacementAction {
  if (status === "ADJUST") return "ADJUST_QUANTITY";
  if (status === "MISSING") return "LOG_LOSS";
  if (status === "REMOVE") return "REMOVE_FROM_TANK";
  if (status === "FOUND_EXTRA") return "CREATE_ITEM";
  if (status === "MAINTENANCE_NEEDED") return "NOTE_ONLY";
  if (status === "CONDITION_NOTED") return "NOTE_ONLY";
  return "CONFIRM";
}

export async function createTankAuditSession(input: { collectionId: string; aquariumId: string; userId: string; title?: string | null }) {
  const existing = await prisma.tankAuditSession.findFirst({ where: activeAuditWhere(input.collectionId, input.aquariumId), orderBy: { openedAt: "desc" } });
  if (existing) return existing;

  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: input.aquariumId, collectionId: input.collectionId },
    include: {
      items: { include: { speciesDefinition: true, equipmentProfile: true, storageLocation: true, quarantineProject: true }, orderBy: [{ itemType: "asc" }, { name: "asc" }] },
      equipmentAttachments: { include: { item: { include: { speciesDefinition: true, equipmentProfile: true, storageLocation: true, quarantineProject: true } } }, orderBy: [{ role: "asc" }, { sortOrder: "asc" }] }
    }
  });
  const records = new Map<string, { item: typeof aquarium.items[number]; attachmentRoles: string[] }>();
  for (const item of aquarium.items) if (!["ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"].includes(item.status)) records.set(item.id, { item, attachmentRoles: [] });
  for (const attachment of aquarium.equipmentAttachments) {
    const current = records.get(attachment.item.id);
    if (current) current.attachmentRoles.push(attachment.role);
    else records.set(attachment.item.id, { item: attachment.item as never, attachmentRoles: [attachment.role] });
  }
  const now = new Date();
  const session = await prisma.tankAuditSession.create({
    data: {
      collectionId: input.collectionId,
      aquariumId: input.aquariumId,
      title: input.title || `${aquarium.name} tank audit`,
      openedById: input.userId,
      lines: {
        create: Array.from(records.values()).map(({ item, attachmentRoles }) => {
          const snapshot = {
            id: item.id,
            name: item.name,
            itemType: item.itemType,
            species: item.speciesDefinition ? { commonName: item.speciesDefinition.commonName, scientificName: item.speciesDefinition.scientificName } : null,
            quantity: item.quantity,
            unit: item.unit,
            status: item.status,
            placement: { aquariumId: item.aquariumId, storageLocationId: item.storageLocationId, quarantineProjectId: item.quarantineProjectId, attachmentRoles },
            sexBreakdown: item.itemType === "FISH" ? { maleCountApprox: item.maleCountApprox, femaleCountApprox: item.femaleCountApprox, label: formatFishSexBreakdown(item) } : null,
            equipment: item.equipmentProfile ? { equipmentType: item.equipmentProfile.equipmentType, brand: item.equipmentProfile.brand, model: item.equipmentProfile.model, lastMaintainedAt: item.equipmentProfile.lastMaintainedAt } : null,
            notes: item.notes
          };
          return {
            collectionId: input.collectionId,
            aquariumItemId: item.id,
            itemSnapshot: json(snapshot),
            itemType: item.itemType,
            itemName: item.name,
            speciesDefinitionId: item.speciesDefinitionId,
            equipmentProfileId: item.equipmentProfile?.id ?? null,
            expectedQuantity: item.quantity,
            observedQuantity: null,
            expectedPlacementSnapshot: json(snapshot.placement),
            status: "PENDING" as const,
            maleCountApprox: item.maleCountApprox,
            femaleCountApprox: item.femaleCountApprox
          };
        })
      }
    }
  });
  await prisma.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, eventType: "AUDIT", title: "Tank audit started", summary: `${records.size} item(s) snapshotted for true-up.`, eventDate: now, createdById: input.userId, metadata: json({ tankAuditSessionId: session.id }) } });
  await writeAuditLog({ collectionId: input.collectionId, entityType: "TankAuditSession", entityId: session.id, action: "TANK_AUDIT_STARTED", after: { aquariumId: input.aquariumId, lineCount: records.size }, createdById: input.userId });
  return session;
}

export async function getTankAuditSessionForView(input: { collectionId: string; aquariumId: string; auditId: string }) {
  return prisma.tankAuditSession.findFirstOrThrow({
    where: { id: input.auditId, collectionId: input.collectionId, aquariumId: input.aquariumId },
    include: {
      aquarium: { include: { structuredLocation: true } },
      openedBy: { select: { name: true, email: true } },
      finalizedBy: { select: { name: true, email: true } },
      cancelledBy: { select: { name: true, email: true } },
      lines: { include: { speciesDefinition: true, aquariumItem: true, equipmentProfile: true }, orderBy: [{ itemType: "asc" }, { itemName: "asc" }] }
    }
  });
}

export async function getAquariumAuditIndex(input: { collectionId: string; aquariumId: string }) {
  return prisma.tankAuditSession.findMany({
    where: { collectionId: input.collectionId, aquariumId: input.aquariumId },
    include: { _count: { select: { lines: true } }, openedBy: { select: { name: true, email: true } }, finalizedBy: { select: { name: true, email: true } } },
    orderBy: { openedAt: "desc" }
  });
}

export async function finalizeTankAudit(input: { collectionId: string; aquariumId: string; auditId: string; userId: string }) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.tankAuditSession.findFirstOrThrow({
      where: { id: input.auditId, collectionId: input.collectionId, aquariumId: input.aquariumId, status: { in: openStatuses.slice() } },
      include: { lines: { orderBy: { createdAt: "asc" } }, aquarium: true }
    });
    const summary = { confirmed: 0, adjusted: 0, removed: 0, created: 0, maintenance: 0, conditions: 0, notes: 0 };
    const eventNotes: string[] = [];
    for (const line of session.lines) {
      const status = line.status;
      if (status === "PENDING") continue;
      const observed = roundQuantity(line.observedQuantity ?? line.expectedQuantity);
      if (status === "FOUND_EXTRA") {
        if (!line.itemName?.trim() || observed == null || observed <= 0) throw new Error(`Found-extra line "${line.itemName || "Unnamed item"}" needs a name and observed quantity.`);
        const item = await tx.aquariumItem.create({
          data: {
            collectionId: input.collectionId,
            aquariumId: input.aquariumId,
            itemType: line.itemType,
            speciesDefinitionId: line.speciesDefinitionId,
            name: line.itemName,
            quantity: observed,
            unit: defaultUnitForItemType(line.itemType),
            status: "IN_AQUARIUM",
            notes: [line.notes, line.healthNotes, line.growthNotes].filter(Boolean).join("\n") || null,
            ...(line.itemType === "FISH" ? normalizeFishSexCounts({ itemType: line.itemType, quantity: observed, maleCountApprox: line.maleCountApprox == null ? null : String(line.maleCountApprox), femaleCountApprox: line.femaleCountApprox == null ? null : String(line.femaleCountApprox) }) : {})
          }
        });
        await tx.tankAuditLine.update({ where: { id: line.id }, data: { aquariumItemId: item.id } });
        await tx.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, relatedItemId: item.id, relatedSpeciesId: line.speciesDefinitionId, eventType: line.itemType === "PLANT" ? "PLANT_ADDITION" : biologicalTypes.has(line.itemType) ? "LIVESTOCK_ADDITION" : "STOCKING", title: `Found extra during audit: ${line.itemName}`, summary: `${observed} ${defaultUnitForItemType(line.itemType)}`, notes: line.notes, createdById: input.userId, metadata: json({ tankAuditSessionId: session.id, tankAuditLineId: line.id }) } });
        summary.created += 1;
        eventNotes.push(`Created ${line.itemName} (${observed}).`);
        continue;
      }
      if (!line.aquariumItemId) continue;
      const item = await tx.aquariumItem.findFirst({ where: { id: line.aquariumItemId, collectionId: input.collectionId }, include: { equipmentProfile: true } });
      if (!item) continue;
      const sexData = item.itemType === "FISH" && observed != null ? normalizeFishSexCounts({ itemType: item.itemType, quantity: observed, maleCountApprox: line.maleCountApprox == null ? null : String(line.maleCountApprox), femaleCountApprox: line.femaleCountApprox == null ? null : String(line.femaleCountApprox) }) : {};
      if (status === "CONFIRMED" || status === "NO_CHANGE") {
        await tx.aquariumItem.update({ where: { id: item.id }, data: { ...(item.itemType === "FISH" ? sexData : {}) } });
        summary.confirmed += 1;
      } else if (status === "ADJUST" && observed != null) {
        const beforeQuantity = item.quantity;
        await tx.aquariumItem.update({ where: { id: item.id }, data: { quantity: observed, ...(item.itemType === "FISH" ? sexData : {}) } });
        await tx.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, relatedItemId: item.id, relatedSpeciesId: item.speciesDefinitionId, eventType: item.itemType === "PLANT" ? "PLANT_ADDITION" : "STOCKING", title: `Audit quantity adjusted: ${item.name}`, summary: `${beforeQuantity} → ${observed}`, notes: line.notes ?? line.growthNotes, createdById: input.userId, metadata: json({ tankAuditSessionId: session.id, tankAuditLineId: line.id }) } });
        summary.adjusted += 1;
        eventNotes.push(`${item.name}: ${beforeQuantity} → ${observed}.`);
      } else if (status === "REMOVE" && item.itemType === "EQUIPMENT") {
        await tx.aquariumItem.update({ where: { id: item.id }, data: { aquariumId: null, status: "ACTIVE" } });
        await tx.aquariumEquipmentAttachment.deleteMany({ where: { collectionId: input.collectionId, aquariumId: input.aquariumId, itemId: item.id } });
        await tx.aquariumLightingAssignment.updateMany({ where: { aquariumId: input.aquariumId, equipmentItemId: item.id }, data: { enabled: false } });
        await tx.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, relatedItemId: item.id, eventType: "EQUIPMENT_CHANGE", title: `Equipment detached during audit: ${item.name}`, summary: "Detached from aquarium; item record was preserved.", notes: line.notes, createdById: input.userId, metadata: json({ tankAuditSessionId: session.id, tankAuditLineId: line.id }) } });
        summary.removed += 1;
        eventNotes.push(`${item.name}: equipment detached.`);
      } else if (status === "MISSING" || status === "REMOVE") {
        const nextQuantity = status === "MISSING" && observed != null && observed > 0 ? observed : 0;
        await tx.aquariumItem.update({ where: { id: item.id }, data: { quantity: nextQuantity, aquariumId: nextQuantity > 0 ? item.aquariumId : null, status: nextQuantity > 0 ? item.status : "REMOVED", ...(item.itemType === "FISH" && nextQuantity > 0 ? sexData : { maleCountApprox: null, femaleCountApprox: null }) } });
        await tx.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, relatedItemId: item.id, relatedSpeciesId: item.speciesDefinitionId, eventType: biologicalTypes.has(item.itemType) ? "LIVESTOCK_LOSS" : item.itemType === "PLANT" ? "PLANT_REMOVAL" : "TRANSFER", title: `Audit removal: ${item.name}`, summary: nextQuantity > 0 ? `Adjusted remaining quantity to ${nextQuantity}.` : "Removed from tank inventory.", notes: line.notes ?? line.healthNotes, createdById: input.userId, metadata: json({ tankAuditSessionId: session.id, tankAuditLineId: line.id }) } });
        summary.removed += 1;
        eventNotes.push(`${item.name}: removed/marked missing.`);
      } else if (status === "MAINTENANCE_NEEDED") {
        const event = await tx.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, relatedItemId: item.id, eventType: "EQUIPMENT_MAINTENANCE", title: `Audit maintenance noted: ${item.name}`, summary: line.maintenanceNotes ?? line.notes ?? "Maintenance needed from tank audit.", maintenanceType: "EQUIPMENT_INSPECTION", notes: line.maintenanceNotes ?? line.notes, createdById: input.userId, metadata: json({ tankAuditSessionId: session.id, tankAuditLineId: line.id }) } });
        await tx.maintenanceEvent.create({ data: { aquariumEventId: event.id, aquariumId: input.aquariumId, maintenanceType: "EQUIPMENT_INSPECTION", equipmentItemId: item.id, summary: line.maintenanceNotes ?? line.notes ?? "Maintenance needed from tank audit." } });
        summary.maintenance += 1;
      } else if (status === "CONDITION_NOTED") {
        summary.conditions += 1;
      }
      if (line.createCondition && (line.healthNotes || line.maintenanceNotes || line.notes)) {
        const title = `Audit finding: ${item.name}`;
        const condition = await tx.healthCondition.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, entityType: item.itemType === "EQUIPMENT" ? "EQUIPMENT" : item.itemType === "FISH" ? "FISH" : item.itemType === "INVERT" ? "INVERT" : item.itemType === "PLANT" ? "PLANT" : "INVENTORY_ITEM", entityId: item.id, title, conditionType: "Tank audit observation", category: item.itemType === "EQUIPMENT" ? "EQUIPMENT" : "UNKNOWN", severity: "LOW", firstObservedAt: new Date(), lastObservedAt: new Date(), summary: line.healthNotes ?? line.maintenanceNotes ?? line.notes, createdById: input.userId, updatedById: input.userId } });
        await tx.healthConditionLink.create({ data: { collectionId: input.collectionId, conditionId: condition.id, linkedEntityType: item.itemType === "EQUIPMENT" ? "EQUIPMENT" : "INVENTORY_ITEM", linkedEntityId: item.id, relationship: "AFFECTS" } });
        const event = await tx.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, relatedItemId: item.id, relatedConditionId: condition.id, eventType: item.itemType === "EQUIPMENT" ? "EQUIPMENT_ISSUE_LOGGED" : "CONDITION_CREATED", title: `Condition from tank audit: ${item.name}`, summary: condition.summary, createdById: input.userId, metadata: json({ tankAuditSessionId: session.id, tankAuditLineId: line.id }) } });
        await tx.healthConditionLink.create({ data: { collectionId: input.collectionId, conditionId: condition.id, linkedEntityType: "TIMELINE_EVENT", linkedEntityId: event.id, relationship: "RELATED_TO" } });
      }
    }
    if (session.lines.some((line) => line.status === "REMOVE" && line.itemType === "EQUIPMENT" && line.aquariumItemId)) {
      const equipmentIds = session.lines.filter((line) => line.status === "REMOVE" && line.itemType === "EQUIPMENT" && line.aquariumItemId).map((line) => line.aquariumItemId!);
      await tx.aquariumEquipmentAttachment.deleteMany({ where: { collectionId: input.collectionId, aquariumId: input.aquariumId, itemId: { in: equipmentIds } } });
      await tx.aquariumLightingAssignment.updateMany({ where: { aquariumId: input.aquariumId, equipmentItemId: { in: equipmentIds } }, data: { enabled: false } });
    }
    const finalized = await tx.tankAuditSession.update({ where: { id: session.id }, data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: input.userId, notes: session.notes } });
    await tx.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, eventType: "AUDIT", title: "Tank audit finalized", summary: `${summary.confirmed} confirmed · ${summary.adjusted} adjusted · ${summary.removed} removed · ${summary.created} found extra`, notes: eventNotes.join("\n") || null, createdById: input.userId, metadata: json({ tankAuditSessionId: session.id, summary }) } });
    return { finalized, summary };
  });
  await writeAuditLog({ collectionId: input.collectionId, entityType: "TankAuditSession", entityId: input.auditId, action: "TANK_AUDIT_FINALIZED", after: result.summary, createdById: input.userId });
  return result;
}

export async function renderTankAuditWorksheet(input: { collectionId: string; aquariumId: string; auditId: string; userId: string }) {
  const session = await getTankAuditSessionForView(input);
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 748;
  const margin = 42;
  const line = (text: string, size = 10, useBold = false, color = rgb(0.08, 0.22, 0.25)) => {
    if (y < 70) { page = pdf.addPage([612, 792]); y = 748; }
    page.drawText(text.slice(0, 108), { x: margin, y, size, font: useBold ? bold : font, color });
    y -= size + 8;
  };
  line("Fluxpoint Tank Audit Worksheet", 18, true);
  line(`${session.aquarium.name} · ${session.aquarium.volumeGallons ?? "—"} gal · ${session.aquarium.structuredLocation?.name ?? session.aquarium.location ?? "No location"}`, 10);
  line(`Audit ${session.id} · opened ${session.openedAt.toLocaleString()} · generated ${new Date().toLocaleString()}`, 9, false, rgb(0.3, 0.42, 0.45));
  y -= 8;
  const groups = new Map<string, typeof session.lines>();
  for (const lineItem of session.lines) {
    const group = auditGroupForItemType(lineItem.itemType);
    groups.set(group, [...(groups.get(group) ?? []), lineItem]);
  }
  for (const [group, lines] of groups) {
    y -= 6;
    line(group, 13, true, rgb(0.0, 0.42, 0.48));
    for (const item of lines) {
      if (y < 115) { page = pdf.addPage([612, 792]); y = 748; line(group, 13, true, rgb(0.0, 0.42, 0.48)); }
      page.drawRectangle({ x: margin, y: y - 58, width: 528, height: 64, borderColor: rgb(0.75, 0.85, 0.85), borderWidth: 0.8 });
      drawText(page, bold, item.itemName, margin + 8, y - 10, 10, 250);
      drawText(page, font, item.speciesDefinition?.scientificName ?? item.speciesDefinition?.commonName ?? "", margin + 8, y - 25, 8, 250);
      drawText(page, font, `Expected: ${item.expectedQuantity ?? "—"} ${item.aquariumItem?.unit ?? ""}`, margin + 280, y - 10, 9, 95);
      drawText(page, font, "Observed: __________", margin + 392, y - 10, 9, 120);
      drawText(page, font, "☐ confirmed   ☐ adjust   ☐ missing/remove", margin + 280, y - 27, 8, 220);
      drawText(page, font, item.itemType === "FISH" ? "Male ___  Female ___  Unsexed ___  Health notes: __________________" : item.itemType === "EQUIPMENT" ? "Attached? ☐ yes ☐ no   Maintenance needed? ☐   Notes: __________________" : "Notes: __________________________________________________", margin + 8, y - 45, 8, 500);
      y -= 72;
    }
    for (let index = 0; index < 2; index += 1) {
      if (y < 90) { page = pdf.addPage([612, 792]); y = 748; }
      page.drawRectangle({ x: margin, y: y - 40, width: 528, height: 46, borderColor: rgb(0.83, 0.88, 0.86), borderWidth: 0.6 });
      drawText(page, font, `Found extra ${group.toLowerCase()}: name/species __________________ quantity ______ notes __________________`, margin + 8, y - 18, 8, 500);
      y -= 54;
    }
  }
  await prisma.tankAuditSession.update({ where: { id: session.id }, data: { worksheetGeneratedAt: new Date(), worksheetFilePath: `/aquariums/${input.aquariumId}/audit/${input.auditId}/worksheet` } });
  await writeAuditLog({ collectionId: input.collectionId, entityType: "TankAuditSession", entityId: input.auditId, action: "TANK_AUDIT_WORKSHEET_GENERATED", createdById: input.userId });
  return pdf.save();
}

function drawText(page: PDFPage, font: PDFFont, value: string, x: number, y: number, size: number, maxWidth: number) {
  const approx = Math.max(10, Math.floor(maxWidth / (size * 0.55)));
  page.drawText(value.length > approx ? `${value.slice(0, approx - 1)}…` : value, { x, y, size, font, color: rgb(0.08, 0.22, 0.25) });
}
