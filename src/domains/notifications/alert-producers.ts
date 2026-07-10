import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { deliverNotification } from "@/domains/notifications/notification-service";
import { processDueWorkflowNotifications } from "@/domains/workflows/workflow-service";

function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }
function weekKey(date = new Date()) { const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); const week = Math.ceil((((date.getTime() - first.getTime()) / 86400000) + first.getUTCDay() + 1) / 7); return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; }

async function collectionRecipients(collectionId: string, db: PrismaClient) {
  const collection = await db.collection.findUnique({ where: { id: collectionId }, select: { ownerId: true, memberships: { where: { role: { in: ["COLLECTION_OWNER", "AQUARIST", "FISHKEEPER"] } }, select: { userId: true } } } });
  if (!collection) return [];
  return [...new Set([collection.ownerId, ...collection.memberships.map((membership) => membership.userId)])];
}

async function notifyCollection(collectionId: string, input: Omit<Parameters<typeof deliverNotification>[0], "userId" | "collectionId">, db: PrismaClient) {
  const recipients = await collectionRecipients(collectionId, db);
  await Promise.all(recipients.map((userId) => deliverNotification({ ...input, userId, collectionId }, db)));
  return recipients.length;
}

export async function produceCareAlerts(now = new Date(), db: PrismaClient = prisma) {
  const tasks = await db.careTask.findMany({ where: { status: { in: ["PENDING", "OVERDUE"] }, dueAt: { lte: now }, emergencyIncidentStepId: null }, include: { careSchedule: true }, orderBy: { dueAt: "asc" }, take: 100 });
  let recipients = 0;
  for (const task of tasks) {
    const type = task.careSchedule.scheduleType === "CONDITION_CHECK" ? "CONDITION_FOLLOW_UP" : task.careSchedule.scheduleType === "TESTING" ? "WATER_TEST_REMINDER" : task.careSchedule.scheduleType === "DOSING" ? "MEDICATION_REMINDER" : ["MAINTENANCE", "EQUIPMENT_SERVICE", "WATER_CHANGE"].includes(task.careSchedule.scheduleType) ? "MAINTENANCE_REMINDER" : "CARE_REMINDER";
    const title = type === "CONDITION_FOLLOW_UP" ? "Condition follow-up due" : type === "WATER_TEST_REMINDER" ? "Water test due" : type === "MEDICATION_REMINDER" ? "Medication dose due" : type === "MAINTENANCE_REMINDER" ? "Aquarium maintenance overdue" : "Aquarium care due";
    recipients += await notifyCollection(task.careSchedule.collectionId, { type, title, body: "A scheduled aquarium task needs attention.", url: task.aquariumId ? `/aquariums/${task.aquariumId}#maintenance` : "/schedules", dedupeKey: `care-task:${task.id}:${task.dueAt.toISOString()}`, entityType: "CareTask", entityId: task.id }, db);
  }
  return { scanned: tasks.length, recipients };
}

export async function produceEmergencyAlerts(now = new Date(), db: PrismaClient = prisma) {
  const steps = await db.emergencyIncidentStep.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      dueAt: { lte: now },
      incident: { status: { in: ["ACTIVE", "STABILIZING", "RECOVERING", "VERIFYING"] } }
    },
    include: { incident: true },
    orderBy: { dueAt: "asc" },
    take: 100
  });
  let recipients = 0;
  for (const step of steps) {
    recipients += await notifyCollection(step.collectionId, {
      type: "EMERGENCY_RESPONSE",
      title: "Emergency response check due",
      body: `${step.incident.title}: ${step.title}`,
      url: "/emergency-response",
      dedupeKey: `emergency-step:${step.id}:${step.dueAt?.toISOString() ?? "now"}`,
      entityType: "EmergencyIncidentStep",
      entityId: step.id
    }, db);
  }
  return { scanned: steps.length, recipients };
}

export async function produceConditionAlerts(now = new Date(), db: PrismaClient = prisma) {
  const conditions = await db.healthCondition.findMany({ where: { status: { in: ["WORSENING", "ACTIVE", "TREATING"] }, OR: [{ severity: "CRITICAL" }, { status: "WORSENING" }] }, take: 100 });
  let recipients = 0;
  for (const condition of conditions) {
    const worsening = condition.status === "WORSENING";
    recipients += await notifyCollection(condition.collectionId, { type: worsening ? "CONDITION_WORSENING_ALERT" : "CONDITION_CRITICAL_ALERT", title: worsening ? "Aquarium condition worsening" : "Critical aquarium condition", body: "A recorded condition needs keeper attention.", url: `/conditions/${condition.id}`, dedupeKey: `condition-alert:${condition.id}:${condition.status}:${condition.updatedAt.toISOString()}`, entityType: "HealthCondition", entityId: condition.id }, db);
  }
  return { scanned: conditions.length, recipients, at: now.toISOString() };
}

export async function produceMedicationAlerts(now = new Date(), db: PrismaClient = prisma) {
  const courses = await db.medicationCourse.findMany({ where: { status: "ACTIVE" }, include: { medicationDefinition: true, doseEvents: { orderBy: { dosedAt: "desc" }, take: 1 } }, take: 100 });
  let due = 0; let recipients = 0;
  for (const course of courses) {
    const schedule = (course.doseSchedule || {}) as { repeatIntervalHours?: number };
    const interval = Number(schedule.repeatIntervalHours || course.medicationDefinition.repeatIntervalHours || 0);
    if (!interval) continue;
    const lastDose = course.doseEvents[0]?.dosedAt || course.startedAt;
    const nextDose = new Date(lastDose.getTime() + interval * 3600000);
    if (nextDose > now) continue;
    due += 1;
    recipients += await notifyCollection(course.collectionId, { type: "MEDICATION_REMINDER", title: "Medication dose due", body: "An active treatment course is ready for its next scheduled dose.", url: `/aquariums/${course.aquariumId}#medications`, dedupeKey: `medication:${course.id}:${nextDose.toISOString()}`, entityType: "MedicationCourse", entityId: course.id }, db);
  }
  return { scanned: courses.length, due, recipients };
}

export async function produceQuarantineAlerts(now = new Date(), db: PrismaClient = prisma) {
  const projects = await db.quarantineProject.findMany({ where: { status: "ACTIVE" }, take: 100 });
  let recipients = 0;
  for (const project of projects) recipients += await notifyCollection(project.collectionId, { type: "QUARANTINE_REMINDER", title: "Quarantine check due", body: "An active quarantine project is ready for a daily observation.", url: "/quarantine", dedupeKey: `quarantine:${project.id}:${dayKey(now)}`, entityType: "QuarantineProject", entityId: project.id }, db);
  return { scanned: projects.length, recipients };
}

export async function produceMetricAlerts(db: PrismaClient = prisma) {
  const configs = await db.aquariumMetricConfig.findMany({ where: { enabled: true, latestValue: { isNot: null } }, include: { latestValue: true, metricDefinition: true }, take: 200 });
  let abnormal = 0; let recipients = 0;
  for (const config of configs) {
    const value = config.latestValue?.value; if (value == null) continue;
    const min = config.minValue ?? config.metricDefinition.defaultMin; const max = config.maxValue ?? config.metricDefinition.defaultMax;
    if ((min == null || value >= min) && (max == null || value <= max)) continue;
    abnormal += 1;
    recipients += await notifyCollection(config.collectionId, { type: "METRIC_THRESHOLD_ALERT", title: "Aquarium metric outside target", body: "A tracked water metric is outside its configured range.", url: `/aquariums/${config.aquariumId}#metrics`, dedupeKey: `metric:${config.id}:${config.latestValue!.measuredAt.toISOString()}`, entityType: "AquariumMetricConfig", entityId: config.id }, db);
  }
  return { scanned: configs.length, abnormal, recipients };
}

export async function produceAquariumIntelligenceAlerts(now = new Date(), db: PrismaClient = prisma) {
  const aquariums = await db.aquarium.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      collectionId: true,
      healthAssessments: { orderBy: { assessedAt: "desc" }, take: 2 },
      parameterAnalyses: { where: { concernState: { in: ["WATCH", "CONCERN", "CRITICAL"] } }, orderBy: { analyzedAt: "desc" }, take: 8 }
    },
    take: 200
  });
  let healthAlerts = 0;
  let parameterAlerts = 0;
  let recipients = 0;
  for (const aquarium of aquariums) {
    const latest = aquarium.healthAssessments[0];
    const previous = aquarium.healthAssessments[1];
    if (latest?.healthState === "CRITICAL") {
      healthAlerts += 1;
      recipients += await notifyCollection(aquarium.collectionId, {
        type: "AQUARIUM_HEALTH_CRITICAL",
        title: "Aquarium health is critical",
        body: `${aquarium.name} has a critical Aquarium Intelligence assessment. Review the evidence before acting.`,
        url: `/aquariums/${aquarium.id}?workspace=intelligence#workspace`,
        dedupeKey: `aquarium-health-critical:${latest.id}`,
        entityType: "AquariumHealthAssessment",
        entityId: latest.id
      }, db);
    } else if (latest?.healthState === "CONCERN" && previous && !["CONCERN", "CRITICAL"].includes(previous.healthState)) {
      healthAlerts += 1;
      recipients += await notifyCollection(aquarium.collectionId, {
        type: "AQUARIUM_HEALTH_CONCERN",
        title: "Aquarium health needs review",
        body: `${aquarium.name} worsened to a concerning Aquarium Intelligence state.`,
        url: `/aquariums/${aquarium.id}?workspace=intelligence#workspace`,
        dedupeKey: `aquarium-health-concern:${latest.id}`,
        entityType: "AquariumHealthAssessment",
        entityId: latest.id
      }, db);
    }

    for (const analysis of aquarium.parameterAnalyses) {
      const significant = ["CONCERN", "CRITICAL"].includes(analysis.concernState);
      if (!significant) continue;
      if (["RISING", "FALLING"].includes(analysis.trendState)) {
        parameterAlerts += 1;
        recipients += await notifyCollection(aquarium.collectionId, {
          type: "AQUARIUM_PARAMETER_DRIFT",
          title: "Aquarium parameter drift",
          body: `${aquarium.name}: ${analysis.metricKey} is ${analysis.trendState.toLowerCase()} and ${analysis.concernState.toLowerCase()}.`,
          url: `/aquariums/${aquarium.id}?workspace=intelligence#workspace`,
          dedupeKey: `aquarium-parameter-drift:${analysis.id}`,
          entityType: "AquariumParameterAnalysis",
          entityId: analysis.id
        }, db);
      }
      if (analysis.stabilityState === "UNSTABLE") {
        parameterAlerts += 1;
        recipients += await notifyCollection(aquarium.collectionId, {
          type: "AQUARIUM_PARAMETER_INSTABILITY",
          title: "Aquarium parameter instability",
          body: `${aquarium.name}: ${analysis.metricKey} is unstable. Review sensor reliability and tank context.`,
          url: `/aquariums/${aquarium.id}?workspace=intelligence#workspace`,
          dedupeKey: `aquarium-parameter-instability:${analysis.id}`,
          entityType: "AquariumParameterAnalysis",
          entityId: analysis.id
        }, db);
      }
    }
  }

  const failures = await db.serverWorkerRun.findMany({ where: { workerName: "aquarium-intelligence", status: "FAILED", startedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }, take: 20 });
  const admins = failures.length ? await db.user.findMany({ where: { serverRole: "SERVER_ADMIN", disabledAt: null }, select: { id: true } }) : [];
  for (const failure of failures) {
    for (const admin of admins) {
      await deliverNotification({
        userId: admin.id,
        type: "AQUARIUM_INTELLIGENCE_FAILURE",
        title: "Aquarium Intelligence worker failed",
        body: failure.error || "The Aquarium Intelligence worker recorded a failure.",
        url: "/server-maintenance",
        dedupeKey: `aquarium-intelligence-failure:${failure.id}`,
        entityType: "ServerWorkerRun",
        entityId: failure.id
      }, db);
      recipients += 1;
    }
  }
  return { scanned: aquariums.length, healthAlerts, parameterAlerts, failures: failures.length, recipients };
}

export async function produceServerAlerts(db: PrismaClient = prisma) {
  const [admins, incidents, failedBackups] = await Promise.all([
    db.user.findMany({ where: { serverRole: "SERVER_ADMIN", disabledAt: null }, select: { id: true } }),
    db.serverIncident.findMany({ where: { status: "OPEN", severity: { in: ["WARNING", "CRITICAL"] } }, take: 50 }),
    db.backupRun.findMany({ where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);
  for (const admin of admins) {
    for (const incident of incidents) await deliverNotification({ userId: admin.id, type: "SERVER_HEALTH_ALERT", title: "Fluxpoint server incident", body: "Server Maintenance has an open operational incident.", url: "/server-maintenance#health", dedupeKey: `server-incident:${incident.id}`, entityType: "ServerIncident", entityId: incident.id }, db);
    for (const backup of failedBackups) await deliverNotification({ userId: admin.id, type: "SERVER_HEALTH_ALERT", title: "Fluxpoint backup failed", body: "A sitewide backup needs administrator attention.", url: "/server-maintenance#backups", dedupeKey: `backup-failed:${backup.id}`, entityType: "BackupRun", entityId: backup.id }, db);
  }
  return { admins: admins.length, incidents: incidents.length, failedBackups: failedBackups.length };
}

export async function produceEddyDigests(now = new Date(), db: PrismaClient = prisma) {
  const users = await db.user.findMany({ where: { disabledAt: null, notificationPreference: { is: { OR: [{ eddyDigestEmailEnabled: true }, { eddyDigestPushEnabled: true }] } } }, include: { collectionMemberships: { select: { collectionId: true } }, collections: { select: { id: true } } } });
  let sent = 0;
  for (const user of users) {
    const collectionIds = [...new Set([...user.collectionMemberships.map((membership) => membership.collectionId), ...user.collections.map((collection) => collection.id)])];
    const due = await db.careTask.count({ where: { status: { in: ["PENDING", "OVERDUE"] }, dueAt: { lte: now }, careSchedule: { collectionId: { in: collectionIds } } } });
    const activeQuarantine = await db.quarantineProject.count({ where: { collectionId: { in: collectionIds }, status: "ACTIVE" } });
    const activeConditions = await db.healthCondition.count({ where: { collectionId: { in: collectionIds }, status: { in: ["WATCHING", "ACTIVE", "TREATING", "IMPROVING", "WORSENING"] } } });
    await deliverNotification({ userId: user.id, type: "EDDY_DIGEST", title: "Your weekly Eddy waterline", body: `${due} care task(s) due, ${activeQuarantine} active quarantine project(s), and ${activeConditions} active condition(s).`, url: "/dashboard", dedupeKey: `eddy-digest:${weekKey(now)}`, entityType: "User", entityId: user.id }, db);
    sent += 1;
  }
  return { eligible: users.length, sent };
}

export async function produceAquariumIntelligenceDigests(now = new Date(), db: PrismaClient = prisma) {
  const users = await db.user.findMany({ where: { disabledAt: null, notificationPreference: { is: { OR: [{ aquariumIntelligenceDigestEmailEnabled: true }, { aquariumIntelligenceDigestPushEnabled: true }] } } }, include: { collectionMemberships: { select: { collectionId: true } }, collections: { select: { id: true } } } });
  let sent = 0;
  for (const user of users) {
    const collectionIds = [...new Set([...user.collectionMemberships.map((membership) => membership.collectionId), ...user.collections.map((collection) => collection.id)])];
    const [critical, concern, drift, stale] = await Promise.all([
      db.aquariumHealthAssessment.count({ where: { collectionId: { in: collectionIds }, healthState: "CRITICAL", assessedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
      db.aquariumHealthAssessment.count({ where: { collectionId: { in: collectionIds }, healthState: "CONCERN", assessedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
      db.aquariumParameterAnalysis.count({ where: { collectionId: { in: collectionIds }, concernState: { in: ["CONCERN", "CRITICAL"] }, analyzedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
      db.aquarium.count({ where: { collectionId: { in: collectionIds }, status: "ACTIVE", healthAssessments: { none: { assessedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } } } })
    ]);
    await deliverNotification({ userId: user.id, type: "AQUARIUM_INTELLIGENCE_DIGEST", title: "Weekly Aquarium Intelligence digest", body: `${critical} critical, ${concern} concerning, ${drift} drift concern(s), and ${stale} stale or unassessed tank(s).`, url: "/intelligence", dedupeKey: `aquarium-intelligence-digest:${weekKey(now)}`, entityType: "User", entityId: user.id }, db);
    sent += 1;
  }
  return { eligible: users.length, sent };
}

export async function produceAllNotificationAlerts(now = new Date(), db: PrismaClient = prisma) {
  const [care, emergency, medication, quarantine, metrics, conditions, intelligence, server, digest, intelligenceDigest, workflows] = await Promise.all([produceCareAlerts(now, db), produceEmergencyAlerts(now, db), produceMedicationAlerts(now, db), produceQuarantineAlerts(now, db), produceMetricAlerts(db), produceConditionAlerts(now, db), produceAquariumIntelligenceAlerts(now, db), produceServerAlerts(db), produceEddyDigests(now, db), produceAquariumIntelligenceDigests(now, db), processDueWorkflowNotifications(now, db)]);
  return { care, emergency, medication, quarantine, metrics, conditions, intelligence, server, digest, intelligenceDigest, workflows };
}
