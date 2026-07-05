import type { NotificationPreference, NotificationType } from "@prisma/client";

export const notificationRows = [
  { type: "CARE_REMINDER", label: "Care reminders", email: "careEmailEnabled", push: "carePushEnabled" },
  { type: "EMERGENCY_RESPONSE", label: "Emergency response checks", email: "emergencyResponseEmailEnabled", push: "emergencyResponsePushEnabled" },
  { type: "MAINTENANCE_REMINDER", label: "Maintenance reminders", email: "maintenanceEmailEnabled", push: "maintenancePushEnabled" },
  { type: "MEDICATION_REMINDER", label: "Medication reminders", email: "medicationEmailEnabled", push: "medicationPushEnabled" },
  { type: "QUARANTINE_REMINDER", label: "Quarantine reminders", email: "quarantineEmailEnabled", push: "quarantinePushEnabled" },
  { type: "WATER_TEST_REMINDER", label: "Water test reminders", email: "waterTestEmailEnabled", push: "waterTestPushEnabled" },
  { type: "METRIC_THRESHOLD_ALERT", label: "Abnormal metric thresholds", email: "metricThresholdEmailEnabled", push: "metricThresholdPushEnabled" },
  { type: "SERVER_HEALTH_ALERT", label: "Server health and backup alerts", email: "serverHealthEmailEnabled", push: "serverHealthPushEnabled" },
  { type: "EDDY_DIGEST", label: "Eddy weekly digest", email: "eddyDigestEmailEnabled", push: "eddyDigestPushEnabled" },
  { type: "CONDITION_FOLLOW_UP", label: "Condition follow-ups", email: "conditionFollowUpEmailEnabled", push: "conditionFollowUpPushEnabled" },
  { type: "CONDITION_CRITICAL_ALERT", label: "Critical conditions", email: "conditionCriticalEmailEnabled", push: "conditionCriticalPushEnabled" },
  { type: "CONDITION_WORSENING_ALERT", label: "Worsening conditions", email: "conditionWorseningEmailEnabled", push: "conditionWorseningPushEnabled" }
] as const satisfies ReadonlyArray<{ type: NotificationType; label: string; email: keyof NotificationPreference; push: keyof NotificationPreference }>;

export function preferenceFields(type: NotificationType) {
  if (type === "WORKFLOW_REMINDER") return notificationRows.find((row) => row.type === "CARE_REMINDER") ?? null;
  return notificationRows.find((row) => row.type === type) ?? null;
}

export function validTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return value; } catch { return "America/New_York"; }
}

export function validTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}
