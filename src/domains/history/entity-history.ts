import { prisma } from "@/lib/db/prisma";

export type EntityHistoryEntry = {
  id: string;
  occurredAt: Date;
  sourceType: "INVENTORY" | "TRANSFER" | "TIMELINE" | "CONDITION" | "OBSERVATION" | "MEDICATION" | "MEDIA" | "QUARANTINE" | "LABEL";
  eventType: string;
  title: string;
  summary: string | null;
  severity: string | null;
  status: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
};

function place(input: { aquarium?: { name: string; generatedName: string | null } | null; storage?: { name: string } | null; quarantine?: { name: string } | null }) {
  return input.aquarium?.generatedName ?? input.aquarium?.name ?? input.storage?.name ?? input.quarantine?.name ?? "unassigned";
}

export async function getInventoryEntityHistory(collectionId: string, itemId: string): Promise<EntityHistoryEntry[]> {
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, collectionId }, include: { speciesDefinition: true } });
  const [transfers, events, conditions, media, quarantine, labels, qr] = await Promise.all([
    prisma.itemTransfer.findMany({ where: { OR: [{ itemId }, { destinationItemId: itemId }] }, include: { fromAquarium: true, toAquarium: true, fromStorageLocation: true, toStorageLocation: true, fromQuarantineProject: true, toQuarantineProject: true, createdBy: true } }),
    prisma.aquariumEvent.findMany({ where: { collectionId, OR: [{ relatedItemId: itemId }, { maintenanceEvent: { is: { equipmentItemId: itemId } } }, { feedingEvent: { is: { OR: [{ targetItemId: itemId }, { foodItemId: itemId }] } } }] }, include: { aquarium: true, maintenanceEvent: true, feedingEvent: true, medicationDoseEvent: { include: { medicationCourse: { include: { medicationDefinition: true } } } } } }),
    prisma.healthCondition.findMany({
      where: {
        collectionId,
        OR: [
          { entityId: itemId },
          { links: { some: { linkedEntityId: itemId, linkedEntityType: { in: ["INVENTORY_ITEM", "EQUIPMENT"] } } } }
        ]
      },
      include: { observations: true, medicationCourses: { include: { medicationDefinition: true } } }
    }),
    prisma.mediaAsset.findMany({ where: { collectionId, itemId }, orderBy: { createdAt: "asc" } }),
    prisma.quarantineItem.findMany({ where: { itemId }, include: { quarantineProject: true } }),
    prisma.generatedLabel.findMany({ where: { collectionId, entityId: itemId, entityType: { in: ["INVENTORY", "EQUIPMENT"] } } }),
    prisma.qrCode.findFirst({ where: { collectionId, entityId: itemId, entityType: { in: ["INVENTORY", "EQUIPMENT"] } } })
  ]);
  const rows: EntityHistoryEntry[] = [{ id: `created:${item.id}`, occurredAt: item.acquiredAt ?? item.createdAt, sourceType: "INVENTORY", eventType: item.acquiredAt ? "ACQUIRED" : "CREATED", title: item.acquiredAt ? `Acquired ${item.name}` : `Created ${item.name}`, summary: [item.quantity, item.unit, item.speciesDefinition?.commonName].filter(Boolean).join(" ") || item.description, severity: null, status: item.status, linkedEntityType: "INVENTORY", linkedEntityId: item.id, url: `/inventory/${item.id}`, metadata: null }];
  for (const transfer of transfers) {
    const from = place({ aquarium: transfer.fromAquarium, storage: transfer.fromStorageLocation, quarantine: transfer.fromQuarantineProject });
    const to = place({ aquarium: transfer.toAquarium, storage: transfer.toStorageLocation, quarantine: transfer.toQuarantineProject });
    rows.push({ id: `transfer:${transfer.id}`, occurredAt: transfer.transferredAt, sourceType: "TRANSFER", eventType: "TRANSFER", title: `Moved ${transfer.quantity} ${item.unit ?? "units"}`, summary: `${from} to ${to}${transfer.reason ? ` - ${transfer.reason}` : ""}`, severity: null, status: null, linkedEntityType: "ITEM_TRANSFER", linkedEntityId: transfer.id, url: null, metadata: transfer.metadata as Record<string, unknown> | null });
  }
  for (const event of events) rows.push({ id: `event:${event.id}`, occurredAt: event.eventDate, sourceType: "TIMELINE", eventType: event.eventType, title: event.title, summary: event.summary ?? event.notes, severity: null, status: null, linkedEntityType: "AQUARIUM", linkedEntityId: event.aquariumId, url: `/aquariums/${event.aquariumId}?workspace=timeline`, metadata: { ...((event.metadata as Record<string, unknown> | null) ?? {}), maintenanceType: event.maintenanceEvent?.maintenanceType ?? undefined } });
  for (const condition of conditions) {
    rows.push({ id: `condition:${condition.id}`, occurredAt: condition.firstObservedAt, sourceType: "CONDITION", eventType: "CONDITION_CREATED", title: condition.title, summary: condition.summary, severity: condition.severity, status: condition.status, linkedEntityType: "HEALTH_CONDITION", linkedEntityId: condition.id, url: `/conditions/${condition.id}`, metadata: { affectedCount: condition.affectedCount, affectedCountLabel: condition.affectedCountLabel } });
    for (const observation of condition.observations) rows.push({ id: `observation:${observation.id}`, occurredAt: observation.observedAt, sourceType: "OBSERVATION", eventType: "CONDITION_OBSERVATION", title: `Observation: ${condition.title}`, summary: observation.notes, severity: observation.severity ?? condition.severity, status: observation.status ?? condition.status, linkedEntityType: "HEALTH_CONDITION", linkedEntityId: condition.id, url: `/conditions/${condition.id}`, metadata: { affectedCount: observation.affectedCount } });
    for (const course of condition.medicationCourses) {
      rows.push({ id: `medication:${course.id}:start`, occurredAt: course.startedAt, sourceType: "MEDICATION", eventType: "MEDICATION_STARTED", title: course.title, summary: `${course.medicationDefinition.name}${course.reason ? ` - ${course.reason}` : ""}`, severity: null, status: course.status, linkedEntityType: "MEDICATION_COURSE", linkedEntityId: course.id, url: `/conditions/${condition.id}`, metadata: null });
      if (course.completedAt) rows.push({ id: `medication:${course.id}:complete`, occurredAt: course.completedAt, sourceType: "MEDICATION", eventType: "MEDICATION_COMPLETED", title: `Completed ${course.title}`, summary: course.notes, severity: null, status: course.status, linkedEntityType: "MEDICATION_COURSE", linkedEntityId: course.id, url: `/conditions/${condition.id}`, metadata: null });
    }
  }
  for (const asset of media) rows.push({ id: `media:${asset.id}`, occurredAt: asset.createdAt, sourceType: "MEDIA", eventType: "PHOTO_UPLOADED", title: asset.caption || "Photo added", summary: `Moderation: ${asset.moderationStatus.toLowerCase()}`, severity: null, status: asset.moderationStatus, linkedEntityType: "MEDIA_ASSET", linkedEntityId: asset.id, url: item.aquariumId ? `/aquariums/${item.aquariumId}?workspace=photos` : null, metadata: null });
  for (const entry of quarantine) rows.push({ id: `quarantine:${entry.id}`, occurredAt: entry.createdAt, sourceType: "QUARANTINE", eventType: "QUARANTINE_ADDED", title: `Added to ${entry.quarantineProject.name}`, summary: entry.notes, severity: null, status: entry.status, linkedEntityType: "QUARANTINE_PROJECT", linkedEntityId: entry.quarantineProjectId, url: "/quarantine", metadata: { quantity: entry.quantity } });
  if (qr) rows.push({ id: `qr:${qr.id}`, occurredAt: qr.createdAt, sourceType: "LABEL", eventType: "QR_CREATED", title: "Stable QR code created", summary: qr.publicCode, severity: null, status: null, linkedEntityType: "QR_CODE", linkedEntityId: qr.id, url: null, metadata: null });
  for (const label of labels) rows.push({ id: `label:${label.id}`, occurredAt: label.createdAt, sourceType: "LABEL", eventType: "LABEL_GENERATED", title: label.labelType.replaceAll("_", " ").toLowerCase(), summary: label.filename, severity: null, status: null, linkedEntityType: "GENERATED_LABEL", linkedEntityId: label.id, url: `/api/labels/${label.id}`, metadata: { sizeBytes: label.sizeBytes } });
  return rows.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}
