import path from "path";
import { readdir, rm } from "fs/promises";
import { prisma } from "@/lib/db/prisma";
import { auditServerAction } from "@/domains/audit/audit-service";
import { ensureDefaultWaterSources } from "@/domains/water/defaults";

export type ResetOptions = {
  dryRun?: boolean;
  preserveAllUsers?: boolean;
  preserveUserEmails?: string[];
  deleteNonPreservedUsers?: boolean;
  createDefaultCollection?: boolean;
  deleteFiles?: boolean;
  deleteOperationalData?: boolean;
  deleteBackupMetadata?: boolean;
  actorUserId?: string;
};

const countQueries = {
  users: () => prisma.user.count(),
  collections: () => prisma.collection.count(),
  memberships: () => prisma.collectionMembership.count(),
  aquariums: () => prisma.aquarium.count(),
  speciesDefinitions: () => prisma.speciesDefinition.count(),
  inventoryItems: () => prisma.aquariumItem.count(),
  events: () => prisma.aquariumEvent.count(),
  mediaAssets: () => prisma.mediaAsset.count(),
  healthConditions: () => prisma.healthCondition.count(),
  lightingSchedules: () => prisma.lightingSchedule.count(),
  medicationDefinitions: () => prisma.medicationDefinition.count(),
  careSchedules: () => prisma.careSchedule.count(),
  workflowTemplates: () => prisma.workflowTemplate.count(),
  aiRequestLogs: () => prisma.aiRequestLog.count(),
  moderationReviews: () => prisma.moderationReview.count(),
  emailLogs: () => prisma.emailLog.count(),
  notificationDeliveries: () => prisma.notificationDelivery.count(),
  qrCodes: () => prisma.qrCode.count(),
  generatedLabels: () => prisma.generatedLabel.count(),
  auditLogs: () => prisma.auditLog.count(),
  serverMetrics: () => prisma.serverMetricSnapshot.count(),
  serverIncidents: () => prisma.serverIncident.count(),
  backupRequests: () => prisma.backupRequest.count()
};

export async function appDataCounts() {
  const entries = await Promise.all(Object.entries(countQueries).map(async ([key, query]) => [key, await query()] as const));
  return Object.fromEntries(entries) as Record<keyof typeof countQueries, number>;
}

export async function buildResetPlan(options: ResetOptions) {
  const preserveAllUsers = options.preserveAllUsers !== false;
  const preserveEmails = [...new Set((options.preserveUserEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, serverRole: true, disabledAt: true } });
  const preservedUsers = preserveAllUsers ? users : users.filter((user) => preserveEmails.includes(user.email.toLowerCase()));
  const deletedUsers = options.deleteNonPreservedUsers ? users.filter((user) => !preservedUsers.some((preserved) => preserved.id === user.id)) : [];
  return {
    counts: await appDataCounts(),
    preservedUsers,
    deletedUsers,
    createDefaultCollection: Boolean(options.createDefaultCollection),
    deleteFiles: Boolean(options.deleteFiles),
    deleteOperationalData: Boolean(options.deleteOperationalData),
    deleteBackupMetadata: Boolean(options.deleteBackupMetadata)
  };
}

async function emptyKnownDirectory(relativePath: string) {
  const root = path.resolve(process.cwd(), relativePath);
  const allowedRoot = path.resolve(process.cwd());
  if (!root.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("Reset path escaped the application root.");
  let entries: string[] = [];
  try { entries = await readdir(root); } catch { return; }
  await Promise.all(entries.map((entry) => rm(path.join(root, entry), { recursive: true, force: true })));
}

export async function resetAppData(options: ResetOptions) {
  const plan = await buildResetPlan(options);
  if (options.dryRun) return { dryRun: true, before: plan.counts, after: plan.counts, ...plan, createdCollection: null };
  if (options.deleteNonPreservedUsers && !plan.preservedUsers.length) throw new Error("At least one user must be preserved.");
  if (options.deleteNonPreservedUsers && !plan.preservedUsers.some((user) => user.serverRole === "SERVER_ADMIN" && !user.disabledAt)) throw new Error("At least one enabled server administrator must be preserved.");
  const actorWillBePreserved = !options.actorUserId || plan.preservedUsers.some((user) => user.id === options.actorUserId);
  if (!actorWillBePreserved) throw new Error("The user executing the reset must be preserved.");

  const createdCollection = await prisma.$transaction(async (tx) => {
    await tx.aiRequestLog.deleteMany();
    await tx.aiRateLimitUsage.deleteMany();
    await tx.aiRateLimitOverride.deleteMany();
    await tx.moderationReview.deleteMany();
    await tx.emailLog.deleteMany();
    await tx.notificationDelivery.deleteMany();
    await tx.collection.deleteMany();
    await tx.aiSuggestion.deleteMany();
    await tx.speciesDefinition.deleteMany();
    await tx.workflowTemplate.deleteMany();
    await tx.qrCode.deleteMany();
    await tx.auditLog.deleteMany();
    if (options.deleteOperationalData) {
      await tx.serverMetricSnapshot.deleteMany();
      await tx.serverIncident.deleteMany();
      await tx.serverHealthCheck.deleteMany();
      await tx.serverWorkerRun.deleteMany();
    }
    if (options.deleteBackupMetadata) await tx.backupRequest.deleteMany();
    if (options.deleteNonPreservedUsers && plan.deletedUsers.length) await tx.user.deleteMany({ where: { id: { in: plan.deletedUsers.map((user) => user.id) } } });
    let freshCollection = null;
    if (options.createDefaultCollection) {
      const owner = plan.preservedUsers.find((user) => user.serverRole === "SERVER_ADMIN") ?? plan.preservedUsers[0];
      if (!owner) throw new Error("A preserved user is required to create a default collection.");
      freshCollection = await tx.collection.create({ data: { name: "Home Aquariums", description: "Fresh Fluxpoint collection created after application data reset.", ownerId: owner.id, memberships: { create: { userId: owner.id, role: "COLLECTION_OWNER" } } } });
    }
    return freshCollection;
  });

  await auditServerAction({ entityType: "Server", entityId: "data-reset", action: "APPLICATION_DATA_RESET", summary: "Fluxpoint application data was reset", severity: "CRITICAL", actorUserId: options.actorUserId && actorWillBePreserved ? options.actorUserId : null, after: { preservedUserEmails: plan.preservedUsers.map((user) => user.email), deletedUserEmails: plan.deletedUsers.map((user) => user.email), createDefaultCollection: options.createDefaultCollection, deleteFiles: options.deleteFiles, deleteOperationalData: options.deleteOperationalData, deleteBackupMetadata: options.deleteBackupMetadata } });
  if (createdCollection) await ensureDefaultWaterSources(createdCollection.id);
  if (options.deleteFiles) await Promise.all(["public/uploads", "public/labels", "public/reports"].map(emptyKnownDirectory));
  return { dryRun: false, before: plan.counts, after: await appDataCounts(), ...plan, createdCollection };
}
