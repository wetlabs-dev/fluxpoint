import { subDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { assessmentWindowDays, parameterToMetricKey } from "@/domains/aquarium-intelligence/thresholds";
import type { NormalizedTimelineEvent, ParameterObservation } from "@/domains/aquarium-intelligence/types";

export async function buildAquariumIntelligenceContext(aquariumId: string, collectionId: string, now = new Date()) {
  const windowStart = subDays(now, assessmentWindowDays);
  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId },
    include: {
      profile: true,
      equipmentAttachments: { include: { item: { include: { equipmentProfile: true } } } },
      items: { include: { speciesDefinition: true } },
      additionalContents: { where: { archivedAt: null } },
      readings: { where: { measuredAt: { gte: windowStart } }, orderBy: { measuredAt: "asc" } },
      events: {
        where: { eventDate: { gte: windowStart } },
        include: { readings: true, waterChangeEvent: true, maintenanceEvent: { include: { equipmentItem: { include: { equipmentProfile: true } } } }, relatedCondition: true, relatedItem: true, relatedSpecies: true },
        orderBy: { eventDate: "asc" }
      },
      careTasks: { where: { createdAt: { gte: windowStart } }, include: { careSchedule: true }, orderBy: { dueAt: "asc" } },
      workflowRuns: { where: { OR: [{ startedAt: { gte: windowStart } }, { status: { in: ["RUNNING", "ACTIVE", "PAUSED"] } }] }, include: { workflowTemplate: true, stepRuns: { include: { workflowStep: true } } } },
      healthConditions: { include: { observations: { orderBy: { observedAt: "desc" }, take: 5 } } },
      medicationCourses: { include: { medicationDefinition: true, doseEvents: true } },
      stockingPressureEstimates: { orderBy: { createdAt: "desc" }, take: 1 },
      waterChangeEvents: { where: { aquariumEvent: { eventDate: { gte: windowStart } } }, include: { aquariumEvent: true }, orderBy: { aquariumEvent: { eventDate: "asc" } } }
    }
  });
  return { aquarium, collectionId, windowStart, windowEnd: now };
}

export type AquariumIntelligenceContext = Awaited<ReturnType<typeof buildAquariumIntelligenceContext>>;

export function parameterObservationsFromContext(context: AquariumIntelligenceContext): ParameterObservation[] {
  return context.aquarium.readings.map((reading) => ({
    id: reading.id,
    metricKey: parameterToMetricKey[reading.parameter] ?? reading.parameter.toLowerCase(),
    parameter: reading.parameter,
    value: reading.value,
    unit: reading.unit,
    source: reading.source,
    measuredAt: reading.measuredAt
  }));
}

export function buildNormalizedEventStream(context: AquariumIntelligenceContext): NormalizedTimelineEvent[] {
  const events: NormalizedTimelineEvent[] = [];
  for (const event of context.aquarium.events) {
    const severity = event.eventType === "DEATH" || event.eventType === "LIVESTOCK_LOSS"
      ? "CONCERN"
      : event.eventType.includes("CONDITION") || event.eventType.includes("EQUIPMENT_ISSUE")
        ? "WATCH"
        : "INFO";
    events.push({
      eventType: event.eventType,
      occurredAt: event.eventDate,
      aquariumId: event.aquariumId,
      entityType: "AquariumEvent",
      entityId: event.id,
      title: event.title,
      summary: event.summary ?? event.notes,
      severity,
      source: "timeline",
      metadata: { relatedItemId: event.relatedItemId, relatedSpeciesId: event.relatedSpeciesId, relatedConditionId: event.relatedConditionId }
    });
  }
  for (const condition of context.aquarium.healthConditions) {
    events.push({
      eventType: `CONDITION_${condition.status}`,
      occurredAt: condition.lastObservedAt ?? condition.firstObservedAt,
      aquariumId: condition.aquariumId ?? context.aquarium.id,
      entityType: "HealthCondition",
      entityId: condition.id,
      title: condition.title,
      summary: condition.summary ?? condition.observations[0]?.notes ?? null,
      severity: condition.severity === "CRITICAL" ? "CRITICAL" : condition.severity === "HIGH" ? "CONCERN" : condition.severity === "MODERATE" ? "WATCH" : "INFO",
      source: "condition",
      metadata: { status: condition.status, severity: condition.severity }
    });
  }
  for (const run of context.aquarium.workflowRuns) {
    events.push({
      eventType: `WORKFLOW_${run.status}`,
      occurredAt: run.completedAt ?? run.cancelledAt ?? run.startedAt,
      aquariumId: context.aquarium.id,
      entityType: "WorkflowRun",
      entityId: run.id,
      title: run.title ?? run.workflowTemplate.name,
      summary: run.notes,
      severity: run.status === "CANCELLED" ? "WATCH" : "INFO",
      source: "workflow",
      metadata: { category: run.workflowTemplate.category, status: run.status }
    });
  }
  return events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
