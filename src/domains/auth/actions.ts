"use server";

import { createHash, randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { appUrl, sendEmail } from "@/domains/email/email-service";
import { passwordResetEmail, welcomeEmail } from "@/domains/email/templates";
import { auditCollectionAction, auditUserAction } from "@/domains/audit/audit-service";
import { AUDIT_EVENTS } from "@/domains/audit/audit-events";

const passwordResetMinutes = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/dashboard";
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.disabledAt || !(await verifyPassword(password, user.passwordHash))) {
    await auditUserAction({ entityType: "User", entityId: user?.id, action: AUDIT_EVENTS.LOGIN_FAILED, summary: "Login failed", actorEmail: email || null, severity: "WARNING", details: { reason: user?.disabledAt ? "account-disabled" : "invalid-credentials" } });
    redirect(`/login?error=invalid${returnTo !== "/dashboard" ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.LOGIN_SUCCEEDED, summary: `${user.name} logged in`, actorUserId: user.id });
  await createSession(user.id);
  redirect(returnTo);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  if (user) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + passwordResetMinutes * 60 * 1000);
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt
      }
    });
    await sendEmail({
      ...passwordResetEmail(appUrl(`/reset-password?token=${token}`)),
      to: user.email,
      userId: user.id,
      template: "password-reset",
      entityType: "User",
      entityId: user.id
    });
    await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.PASSWORD_RESET_REQUESTED, summary: `Password reset requested for ${user.email}`, actorUserId: user.id });
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPasswordWithToken(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 12) redirect(`/reset-password?token=${encodeURIComponent(token)}&error=weak`);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    redirect("/reset-password?error=invalid");
  }

  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { passwordHash: await hashPassword(password) }
  });
  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { usedAt: new Date() }
  });
  await prisma.session.deleteMany({ where: { userId: resetToken.userId } });
  await sendEmail({
    ...welcomeEmail(resetToken.user.email),
    to: resetToken.user.email,
    userId: resetToken.userId,
    template: "password-reset-confirmation",
    entityType: "User",
    entityId: resetToken.userId
  });
  await auditUserAction({ entityType: "User", entityId: resetToken.userId, action: AUDIT_EVENTS.PASSWORD_RESET_COMPLETED, summary: `Password reset completed for ${resetToken.user.email}`, actorUserId: resetToken.userId, severity: "WARNING" });
  redirect("/login?reset=1");
}

export async function logout() {
  const user = await requireUser();
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.LOGOUT, summary: `${user.name} logged out`, actorUserId: user.id });
  await destroySession();
  redirect("/login");
}

export async function acceptCollectionInvitation(formData: FormData) {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  const invitation = await prisma.collectionInvitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) throw new Error("This invitation is no longer valid.");
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) throw new Error("This invitation belongs to a different email address.");
  await prisma.$transaction([
    prisma.collectionMembership.upsert({
      where: { collectionId_userId: { collectionId: invitation.collectionId, userId: user.id } },
      create: { collectionId: invitation.collectionId, userId: user.id, role: invitation.role },
      update: { role: invitation.role }
    }),
    prisma.collectionInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } })
  ]);
  await auditCollectionAction({ collectionId: invitation.collectionId, entityType: "CollectionInvitation", entityId: invitation.id, action: AUDIT_EVENTS.INVITATION_ACCEPTED, after: { role: invitation.role }, actorUserId: user.id });
  redirect("/dashboard");
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Display name must be at least 2 characters.");
  const updated = await prisma.user.update({ where: { id: user.id }, data: { name } });
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.USER_UPDATED, summary: `${updated.email} updated their profile`, before: { name: user.name }, after: { name: updated.name }, actorUserId: user.id });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword.length < 12) throw new Error("New password must be at least 12 characters.");
  const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, freshUser.passwordHash))) {
    throw new Error("Current password did not match.");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) }
  });
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.PASSWORD_CHANGED, summary: `${user.email} changed their password`, actorUserId: user.id, severity: "WARNING" });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await destroySession();
  redirect("/login");
}
