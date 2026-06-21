import type { NotificationChannel, NotificationPreference, NotificationType, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { appUrl, sendEmail } from "@/domains/email/email-service";
import { notificationAlertEmail } from "@/domains/email/templates";
import { preferenceFields } from "@/domains/notifications/preferences";
import { sendPushToUser } from "@/domains/notifications/push";

export type NotificationInput = {
  userId: string;
  collectionId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  url: string;
  dedupeKey: string;
  entityType?: string;
  entityId?: string;
};

function minutes(value?: string | null) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isInQuietHours(preference: Pick<NotificationPreference, "timezone" | "quietHoursStart" | "quietHoursEnd">, now = new Date()) {
  const start = minutes(preference.quietHoursStart); const end = minutes(preference.quietHoursEnd);
  if (start === null || end === null || start === end) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: preference.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const current = Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value || 0);
  return start < end ? current >= start && current < end : current >= start || current < end;
}

async function claim(input: NotificationInput, channel: NotificationChannel, db: PrismaClient) {
  const where = { userId_channel_dedupeKey: { userId: input.userId, channel, dedupeKey: input.dedupeKey } };
  const existing = await db.notificationDelivery.findUnique({ where });
  if (existing && existing.status !== "FAILED") return null;
  if (existing && Date.now() - existing.updatedAt.getTime() < 15 * 60 * 1000) return null;
  if (existing) return db.notificationDelivery.update({ where, data: { status: "PENDING", error: null, attemptCount: { increment: 1 } } });
  return db.notificationDelivery.create({ data: { userId: input.userId, collectionId: input.collectionId, type: input.type, channel, dedupeKey: input.dedupeKey, title: input.title, entityType: input.entityType, entityId: input.entityId, attemptCount: 1 } });
}

export async function deliverNotification(input: NotificationInput, db: PrismaClient = prisma) {
  const user = await db.user.findFirst({ where: { id: input.userId, disabledAt: null }, include: { notificationPreference: true } });
  if (!user) return { email: "skipped", push: "skipped" };
  const preference = user.notificationPreference ?? await db.notificationPreference.create({ data: { userId: user.id } });
  const fields = preferenceFields(input.type);
  if (!fields) return { email: "skipped", push: "skipped" };
  const output = { email: "disabled", push: "disabled" };

  if (preference[fields.email] === true) {
    const delivery = await claim(input, "EMAIL", db);
    if (delivery) {
      try {
        const template = notificationAlertEmail({ title: input.title, body: input.body, actionUrl: appUrl(input.url) });
        const result = await sendEmail({ ...template, to: user.email, userId: user.id, collectionId: input.collectionId, template: `notification-${input.type.toLowerCase()}`, entityType: input.entityType, entityId: input.entityId });
        await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "skipped" in result && result.skipped ? "SKIPPED" : "SENT", recipient: user.email, provider: result.provider, providerId: result.messageId, sentAt: "skipped" in result && result.skipped ? null : new Date() } });
        output.email = "sent";
      } catch (error) {
        await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : String(error) } });
        output.email = "failed";
      }
    }
  }

  if (preference[fields.push] === true && !isInQuietHours(preference)) {
    const delivery = await claim(input, "PUSH", db);
    if (delivery) {
      const result = await sendPushToUser(user.id, { title: input.title, body: input.body, url: input.url, tag: input.dedupeKey }, db);
      const status = result.sent > 0 ? "SENT" : result.configured && result.considered > 0 ? "FAILED" : "SKIPPED";
      await db.notificationDelivery.update({ where: { id: delivery.id }, data: { status, provider: "web-push", sentAt: result.sent > 0 ? new Date() : null, error: status === "FAILED" ? "No registered device accepted the push notification." : null } });
      output.push = status.toLowerCase();
    }
  } else if (preference[fields.push] === true) output.push = "quiet-hours";
  return output;
}
