import webPush from "web-push";
import type { PrismaClient, PushSubscription } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { appUrl } from "@/domains/email/email-service";

export type SafePushNotification = { title: string; body?: string; url: string; tag?: string };

export function webPushEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH === "true";
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!webPushEnabled() || !publicKey || !privateKey) return false;
  webPush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@wetlabs.dev", publicKey, privateKey);
  return true;
}

function payload(notification: SafePushNotification) {
  return JSON.stringify({
    title: notification.title.slice(0, 80),
    body: (notification.body || "Open Fluxpoint for details.").slice(0, 140),
    url: /^https?:\/\//i.test(notification.url) ? notification.url : appUrl(notification.url),
    tag: notification.tag?.slice(0, 100)
  });
}

async function markFailure(subscription: Pick<PushSubscription, "id" | "failureCount">, error: unknown, db: PrismaClient) {
  const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : null;
  const dead = statusCode === 404 || statusCode === 410 || subscription.failureCount >= 4;
  await db.pushSubscription.update({ where: { id: subscription.id }, data: { failureCount: { increment: 1 }, lastFailureAt: new Date(), ...(dead ? { enabled: false, revokedAt: new Date() } : {}) } });
  return statusCode;
}

export async function sendPushToUser(userId: string, notification: SafePushNotification, db: PrismaClient = prisma) {
  if (!configureWebPush()) return { considered: 0, sent: 0, configured: false };
  const subscriptions = await db.pushSubscription.findMany({ where: { userId, enabled: true, revokedAt: null } });
  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload(notification));
      sent += 1;
      await db.pushSubscription.update({ where: { id: subscription.id }, data: { failureCount: 0, lastFailureAt: null, lastSeenAt: new Date() } });
    } catch (error) {
      const statusCode = await markFailure(subscription, error, db);
      console.error("Fluxpoint Web Push delivery failed", { subscriptionId: subscription.id, userId, statusCode, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { considered: subscriptions.length, sent, configured: true };
}
