import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultWaterSources } from "@/domains/water/defaults";

export const SESSION_COOKIE = "fluxpoint_session";
export const TWO_FACTOR_COOKIE = "fluxpoint_2fa";
const SESSION_DAYS = 30;
const TWO_FACTOR_MINUTES = 10;

export type AuthenticatedUser = User & { twoFactorVerifiedAt?: Date | null };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, options: { twoFactorVerifiedAt?: Date | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      twoFactorVerifiedAt: options.twoFactorVerifiedAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function markCurrentSessionTwoFactorVerified() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token) },
    data: { twoFactorVerifiedAt: new Date() }
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(TWO_FACTOR_COOKIE);
}

export async function createTwoFactorChallenge(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TWO_FACTOR_MINUTES * 60 * 1000);
  await prisma.twoFactorChallenge.create({
    data: { userId, tokenHash: hashToken(token), expiresAt }
  });

  const cookieStore = await cookies();
  cookieStore.set(TWO_FACTOR_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function getTwoFactorChallenge() {
  const token = (await cookies()).get(TWO_FACTOR_COOKIE)?.value;
  if (!token) return null;

  const challenge = await prisma.twoFactorChallenge.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { twoFactor: true } } }
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) return null;
  if (challenge.user.disabledAt) return null;
  return challenge;
}

export async function consumeTwoFactorChallenge(challengeId: string) {
  await prisma.twoFactorChallenge.update({
    where: { id: challengeId },
    data: { consumedAt: new Date() }
  });
  (await cookies()).delete(TWO_FACTOR_COOKIE);
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  if (session.user.disabledAt) return null;

  return { ...session.user, twoFactorVerifiedAt: session.twoFactorVerifiedAt };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function assertServerAdminTwoFactorReady(user: Pick<AuthenticatedUser, "id" | "serverRole" | "twoFactorVerifiedAt">) {
  if (user.serverRole !== "SERVER_ADMIN") return;
  const twoFactor = await prisma.userTwoFactor.findUnique({ where: { userId: user.id }, select: { enabledAt: true } });
  if (!twoFactor?.enabledAt) redirect("/account/security?setup=required");
  if (!user.twoFactorVerifiedAt) redirect("/login?twoFactor=expired");
}

export async function getUserCollection(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { serverRole: true } });
  const existing = await prisma.collection.findFirst({
    where: { archivedAt: null, ...(user.serverRole === "SERVER_ADMIN" ? {} : { memberships: { some: { userId } } }) },
    orderBy: { createdAt: "asc" }
  });
  if (existing) return existing;

  if (user.serverRole !== "SERVER_ADMIN") redirect("/access-pending");

  const collection = await prisma.collection.create({
    data: {
      ownerId: userId,
      name: "Home Aquariums",
      description: "Default Fluxpoint collection",
      memberships: { create: { userId, role: "COLLECTION_OWNER" } }
    }
  });
  await ensureDefaultWaterSources(collection.id);
  return collection;
}
