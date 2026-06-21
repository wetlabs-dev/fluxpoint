import assert from "node:assert/strict";
import { prisma } from "../src/lib/db/prisma";
import { produceAllNotificationAlerts } from "../src/domains/notifications/alert-producers";

async function main() {
  if (process.env.NOTIFICATION_TEST_DATABASE !== "true") throw new Error("Refusing to create notification fixtures without NOTIFICATION_TEST_DATABASE=true.");
  const user = await prisma.user.findFirstOrThrow({ where: { serverRole: "SERVER_ADMIN" } });
  const collection = await prisma.collection.findFirstOrThrow({ where: { ownerId: user.id } });
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { collectionId: collection.id } });
  await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: { careEmailEnabled: true, maintenanceEmailEnabled: true, medicationEmailEnabled: true, quarantineEmailEnabled: true, waterTestEmailEnabled: true, metricThresholdEmailEnabled: true, serverHealthEmailEnabled: true, eddyDigestEmailEnabled: true }, create: { userId: user.id, careEmailEnabled: true, maintenanceEmailEnabled: true, medicationEmailEnabled: true, quarantineEmailEnabled: true, waterTestEmailEnabled: true, metricThresholdEmailEnabled: true, serverHealthEmailEnabled: true, eddyDigestEmailEnabled: true } });
  const past = new Date(Date.now() - 48 * 3600000);
  await prisma.careTask.updateMany({ where: { careSchedule: { collectionId: collection.id } }, data: { dueAt: past, status: "PENDING" } });
  const dosingSchedule = await prisma.careSchedule.create({ data: { collectionId: collection.id, aquariumId: aquarium.id, name: "Notification integration dose", scheduleType: "DOSING", cadenceType: "DAILY", startDate: past, nextDueAt: past } });
  await prisma.careTask.create({ data: { careScheduleId: dosingSchedule.id, aquariumId: aquarium.id, title: "Notification integration dose", dueAt: past } });
  await prisma.quarantineProject.create({ data: { collectionId: collection.id, aquariumId: aquarium.id, name: "Notification integration quarantine", startedAt: past } });
  const course = await prisma.medicationCourse.findFirstOrThrow({ where: { collectionId: collection.id, status: "ACTIVE" }, include: { doseEvents: true } });
  await prisma.medicationDoseEvent.updateMany({ where: { medicationCourseId: course.id }, data: { dosedAt: past } });
  const metric = await prisma.aquariumMetricConfig.findFirstOrThrow({ where: { collectionId: collection.id, latestValue: { isNot: null } }, include: { latestValue: true } });
  await prisma.aquariumMetricConfig.update({ where: { id: metric.id }, data: { maxValue: (metric.latestValue?.value ?? 1) - 1 } });
  await prisma.serverIncident.create({ data: { type: `NOTIFICATION_TEST_${Date.now()}`, category: "WORKER", severity: "WARNING", title: "Notification integration incident" } });
  const backup = await prisma.backupRequest.create({ data: { requestedById: user.id, notes: "Notification integration fixture", run: { create: { status: "FAILED", error: "Integration fixture" } } }, include: { run: true } });
  const startedAt = new Date();
  await produceAllNotificationAlerts(new Date(), prisma);
  const deliveries = await prisma.notificationDelivery.findMany({ where: { userId: user.id, createdAt: { gte: startedAt } } });
  for (const type of ["CARE_REMINDER", "MAINTENANCE_REMINDER", "MEDICATION_REMINDER", "QUARANTINE_REMINDER", "WATER_TEST_REMINDER", "METRIC_THRESHOLD_ALERT", "SERVER_HEALTH_ALERT", "EDDY_DIGEST"] as const) assert.ok(deliveries.some((delivery) => delivery.type === type), `${type} was not delivered`);
  const firstCount = deliveries.length;
  await produceAllNotificationAlerts(new Date(), prisma);
  assert.equal(await prisma.notificationDelivery.count({ where: { userId: user.id, createdAt: { gte: startedAt } } }), firstCount, "delivery deduplication failed");
  assert.ok(backup.run);
  console.log(`Fluxpoint notification delivery integration passed with ${firstCount} deduplicated delivery records.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
