"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { notificationRows, validTime, validTimeZone } from "@/domains/notifications/preferences";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { setFormFlash } from "@/lib/forms/form-flash";

export async function updateNotificationPreferences(formData: FormData) {
  const user = await requireUser();
  const data: Record<string, string | boolean | null> = {
    timezone: validTimeZone(String(formData.get("timezone") || "America/New_York")),
    quietHoursStart: validTime(String(formData.get("quietHoursStart") || "")),
    quietHoursEnd: validTime(String(formData.get("quietHoursEnd") || ""))
  };
  for (const row of notificationRows) {
    data[row.email] = formData.get(row.email) === "on";
    data[row.push] = formData.get(row.push) === "on";
  }
  const preference = await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
  await writeAuditLog({ entityType: "NotificationPreference", entityId: preference.id, action: "UPDATE", after: data, createdById: user.id });
  revalidatePath("/account");
  await setFormFlash("Notification preferences saved.");
}
