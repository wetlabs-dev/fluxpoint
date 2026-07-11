import { prisma } from "@/lib/db/prisma";

const configs = [
  { name: "reminders", label: "Reminders", enabledEnv: "ENABLE_REMINDERS_WORKER", intervalMs: Number(process.env.REMINDER_WORKER_INTERVAL_MS || 300000) },
  { name: "metrics", label: "Metrics", enabledEnv: "ENABLE_METRICS_WORKER", intervalMs: Number(process.env.METRICS_WORKER_INTERVAL_MS || 300000) },
  { name: "backups", label: "Backups", enabledEnv: "ENABLE_BACKUPS_WORKER", intervalMs: Number(process.env.BACKUP_WORKER_INTERVAL_SECONDS || 60) * 1000 },
  { name: "ai-worker", label: "AI jobs", enabledEnv: "ENABLE_AI_WORKER", intervalMs: Number(process.env.AI_WORKER_INTERVAL_SECONDS || 15) * 1000, href: "/server-maintenance/ai-jobs" },
  { name: "image-moderation", label: "Image moderation", enabledEnv: "ENABLE_IMAGE_MODERATION_WORKER", intervalMs: Number(process.env.FLUXPOINT_IMAGE_MODERATION_WORKER_INTERVAL_SECONDS || process.env.IMAGE_MODERATION_WORKER_INTERVAL_SECONDS || 180) * 1000 },
  { name: "aquarium-intelligence", label: "Aquarium intelligence", enabledEnv: "ENABLE_INTELLIGENCE_WORKER", intervalMs: Number(process.env.INTELLIGENCE_WORKER_INTERVAL_MS || 3600000) }
];

export async function getWorkerStatuses() {
  const runs = await prisma.serverWorkerRun.findMany({ where: { workerName: { in: configs.map((item) => item.name) } }, orderBy: { startedAt: "desc" }, take: 100 });
  const now = Date.now();
  return configs.map((config) => {
    const enabled = process.env[config.enabledEnv] === "true";
    const latest = runs.find((run) => run.workerName === config.name) ?? null;
    const staleAfter = Math.max(5 * 60_000, config.intervalMs * 3);
    let state: "DISABLED" | "NEVER_RUN" | "HEALTHY" | "STALE" | "RUNNING" | "FAILED" = "DISABLED";
    if (enabled && !latest) state = "NEVER_RUN";
    else if (enabled && latest?.status === "RUNNING") state = "RUNNING";
    else if (enabled && latest?.status === "FAILED") state = "FAILED";
    else if (enabled && latest && now - latest.startedAt.getTime() > staleAfter) state = "STALE";
    else if (enabled && latest) state = "HEALTHY";
    return { ...config, enabled, latest, state, severity: !enabled ? "INFO" : state === "FAILED" ? "CRITICAL" : ["NEVER_RUN", "STALE"].includes(state) ? "WARNING" : "OK" };
  });
}
