import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { sendPushToUser } from "@/domains/notifications/push";
import { auditUserAction } from "@/domains/audit/audit-service";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const dedupeKey = `test-push-${Date.now()}`;
  const delivery = await prisma.notificationDelivery.create({ data: { userId: user.id, type: "TEST_PUSH", channel: "PUSH", dedupeKey, title: "Fluxpoint test notification", attemptCount: 1 } });
  const result = await sendPushToUser(user.id, { title: "Fluxpoint test notification", body: "Push notifications are enabled for this device.", url: "/account", tag: dedupeKey });
  await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: result.sent > 0 ? "SENT" : result.configured && result.considered > 0 ? "FAILED" : "SKIPPED", provider: "web-push", sentAt: result.sent > 0 ? new Date() : null, error: result.sent ? null : "No enabled push device accepted the notification." } });
  await auditUserAction({ entityType: "NotificationDelivery", entityId: delivery.id, action: result.sent > 0 ? "PUSH_NOTIFICATION_SENT" : result.configured && result.considered > 0 ? "PUSH_NOTIFICATION_FAILED" : "PUSH_NOTIFICATION_SKIPPED", summary: result.sent > 0 ? "Test push notification sent" : "Test push notification was not delivered", actorUserId: user.id, severity: result.configured && result.considered > 0 && !result.sent ? "WARNING" : "INFO", metadata: result });
  return NextResponse.json(result);
}
