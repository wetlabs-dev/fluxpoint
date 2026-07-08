import type { Prisma, ServerIncidentCategory, ServerIncidentSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { getServerMaintenanceSettings } from "@/domains/server/settings";

type IncidentSignal = {
  type: string;
  category: ServerIncidentCategory;
  severity: ServerIncidentSeverity;
  title: string;
  description: string;
  metricType: string;
  threshold: number;
  observed: number;
  open: boolean;
  metadata?: Prisma.InputJsonValue;
};

async function applySignal(signal: IncidentSignal) {
  const existing = await prisma.serverIncident.findFirst({ where: { type: signal.type, status: "OPEN" }, orderBy: { detectedAt: "desc" } });
  if (signal.open) {
    if (existing) {
      await prisma.serverIncident.update({ where: { id: existing.id }, data: { observedValue: signal.observed, peakValue: Math.max(existing.peakValue ?? signal.observed, signal.observed), severity: signal.severity, metadata: signal.metadata } });
      return;
    }
    const incident = await prisma.serverIncident.create({ data: { type: signal.type, category: signal.category, severity: signal.severity, title: signal.title, description: signal.description, metricType: signal.metricType, thresholdValue: signal.threshold, observedValue: signal.observed, peakValue: signal.observed, metadata: signal.metadata } });
    await writeAuditLog({ entityType: "ServerIncident", entityId: incident.id, action: "INCIDENT_CREATED", after: incident });
    return;
  }
  if (!existing) return;
  const resolvedAt = new Date();
  const incident = await prisma.serverIncident.update({ where: { id: existing.id }, data: { status: "RESOLVED", resolvedAt, durationSeconds: Math.max(0, Math.round((resolvedAt.getTime() - existing.detectedAt.getTime()) / 1000)), observedValue: signal.observed, metadata: signal.metadata } });
  await writeAuditLog({ entityType: "ServerIncident", entityId: incident.id, action: "INCIDENT_RESOLVED", before: existing, after: incident });
}

export async function evaluateServerIncidents(history: Array<{ capturedAt: Date; metrics: any }>) {
  const recent = history.slice(-3);
  const latest = recent[recent.length - 1];
  if (!latest) return;
  const memoryValues = recent.map((snapshot) => Number(snapshot.metrics.memory?.usedPercent || 0));
  const diskValue = Number(latest.metrics.disk?.usedPercent || 0);
  const settings = await getServerMaintenanceSettings();
  const diskCritical = diskValue >= settings.diskCriticalThresholdPercent;
  const diskWarning = diskValue >= settings.diskWarningThresholdPercent;
  const memoryCritical = memoryValues.length === 3 && memoryValues.every((value) => value >= 90);
  const memoryWarning = memoryValues.length === 3 && memoryValues.every((value) => value >= 75);
  if (memoryCritical || memoryWarning || (memoryValues.length === 3 && memoryValues.every((value) => value < 75))) {
    await applySignal({ type: "MEMORY_PRESSURE", category: "MEMORY", severity: memoryCritical ? "CRITICAL" : "WARNING", title: memoryCritical ? "Critical memory pressure" : "Memory pressure warning", description: "System memory remained above the configured threshold for three snapshots.", metricType: "memory_percent", threshold: memoryCritical ? 90 : 75, observed: memoryValues[memoryValues.length - 1] || 0, open: memoryCritical || memoryWarning, metadata: { samples: memoryValues, capturedAt: recent.map((item) => item.capturedAt.toISOString()) } });
  }
  await applySignal({
    type: "DISK_PRESSURE",
    category: "DISK",
    severity: diskCritical ? "CRITICAL" : "WARNING",
    title: diskCritical ? "Critical disk pressure" : "Disk pressure warning",
    description: "Disk usage crossed the configured server threshold.",
    metricType: "disk_percent",
    threshold: diskCritical ? settings.diskCriticalThresholdPercent : settings.diskWarningThresholdPercent,
    observed: diskValue,
    open: diskCritical || diskWarning,
    metadata: {
      capturedAt: latest.capturedAt.toISOString(),
      diskWarningThresholdPercent: settings.diskWarningThresholdPercent,
      diskCriticalThresholdPercent: settings.diskCriticalThresholdPercent
    }
  });
}

export async function recordWorkerIncident(workerName: string, error: string) {
  const failures = await prisma.serverWorkerRun.count({ where: { workerName, status: "FAILED", startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  await applySignal({ type: `WORKER_${workerName.toUpperCase().replaceAll("-", "_")}`, category: "WORKER", severity: failures >= 3 ? "CRITICAL" : "WARNING", title: `${workerName} worker failure`, description: error, metricType: "worker_failures", threshold: 1, observed: failures, open: true });
}

export async function resolveWorkerIncident(workerName: string) {
  await applySignal({ type: `WORKER_${workerName.toUpperCase().replaceAll("-", "_")}`, category: "WORKER", severity: "WARNING", title: `${workerName} worker recovered`, description: "The worker completed successfully.", metricType: "worker_failures", threshold: 1, observed: 0, open: false });
}
