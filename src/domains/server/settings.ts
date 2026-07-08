import { prisma } from "@/lib/db/prisma";

export const DEFAULT_DISK_WARNING_THRESHOLD_PERCENT = 80;
export const DEFAULT_DISK_CRITICAL_THRESHOLD_PERCENT = 90;

export type ServerMaintenanceSettingsValues = {
  diskWarningThresholdPercent: number;
  diskCriticalThresholdPercent: number;
};

function clampPercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(99, Math.max(1, value));
}

export function normalizeServerMaintenanceSettings(input: Partial<ServerMaintenanceSettingsValues>): ServerMaintenanceSettingsValues {
  const critical = clampPercent(input.diskCriticalThresholdPercent ?? DEFAULT_DISK_CRITICAL_THRESHOLD_PERCENT, DEFAULT_DISK_CRITICAL_THRESHOLD_PERCENT);
  const warning = clampPercent(input.diskWarningThresholdPercent ?? DEFAULT_DISK_WARNING_THRESHOLD_PERCENT, DEFAULT_DISK_WARNING_THRESHOLD_PERCENT);
  return {
    diskWarningThresholdPercent: Math.min(warning, critical),
    diskCriticalThresholdPercent: critical
  };
}

export async function getServerMaintenanceSettings(): Promise<ServerMaintenanceSettingsValues> {
  const settings = await prisma.serverMaintenanceSettings.findUnique({ where: { id: "global" } });
  return normalizeServerMaintenanceSettings({
    diskWarningThresholdPercent: settings?.diskWarningThresholdPercent,
    diskCriticalThresholdPercent: settings?.diskCriticalThresholdPercent
  });
}
