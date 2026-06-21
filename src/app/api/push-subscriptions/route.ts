import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { webPushEnabled } from "@/domains/notifications/push";

function error(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function GET() {
  const user = await getCurrentUser(); if (!user) return error("Authentication required.", 401);
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { updatedAt: "desc" }, select: { id: true, endpoint: true, deviceLabel: true, userAgent: true, enabled: true, createdAt: true, updatedAt: true, lastSeenAt: true } });
  return NextResponse.json({ enabled: webPushEnabled(), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "", subscriptions });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(); if (!user) return error("Authentication required.", 401);
  if (!webPushEnabled()) return error("Web Push is disabled.", 403);
  const input = await request.json().catch(() => null) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; deviceLabel?: unknown } | null;
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  const p256dh = typeof input?.keys?.p256dh === "string" ? input.keys.p256dh : "";
  const auth = typeof input?.keys?.auth === "string" ? input.keys.auth : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 4096 || !p256dh || !auth) return error("A valid browser push subscription is required.");
  const userAgent = (await headers()).get("user-agent")?.slice(0, 500) || null;
  const deviceLabel = typeof input?.deviceLabel === "string" ? input.deviceLabel.trim().slice(0, 80) || null : null;
  const subscription = await prisma.pushSubscription.upsert({ where: { endpoint }, update: { userId: user.id, p256dh, auth, userAgent, deviceLabel, enabled: true, revokedAt: null, failureCount: 0, lastFailureAt: null, lastSeenAt: new Date() }, create: { userId: user.id, endpoint, p256dh, auth, userAgent, deviceLabel, lastSeenAt: new Date() }, select: { id: true, endpoint: true, deviceLabel: true, enabled: true, lastSeenAt: true } });
  return NextResponse.json({ subscription });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(); if (!user) return error("Authentication required.", 401);
  const input = await request.json().catch(() => null) as { endpoint?: unknown; deviceLabel?: unknown } | null;
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  if (!endpoint) return error("A subscription endpoint is required.");
  await prisma.pushSubscription.updateMany({ where: { userId: user.id, endpoint }, data: { lastSeenAt: new Date(), ...(typeof input?.deviceLabel === "string" ? { deviceLabel: input.deviceLabel.trim().slice(0, 80) || null } : {}) } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(); if (!user) return error("Authentication required.", 401);
  const input = await request.json().catch(() => null) as { id?: unknown; endpoint?: unknown } | null;
  const id = typeof input?.id === "string" ? input.id : undefined; const endpoint = typeof input?.endpoint === "string" ? input.endpoint : undefined;
  if (!id && !endpoint) return error("A subscription id or endpoint is required.");
  await prisma.pushSubscription.updateMany({ where: { userId: user.id, ...(id ? { id } : { endpoint }) }, data: { enabled: false, revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
