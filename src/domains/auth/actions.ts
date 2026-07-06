"use server";

import { createHash, randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { consumeTwoFactorChallenge, createSession, createTwoFactorChallenge, destroySession, getCurrentUser, getTwoFactorChallenge, markCurrentSessionTwoFactorVerified, requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { decryptTotpSecret, encryptRecoveryCodes, encryptTotpSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, verifyTotp } from "@/lib/auth/totp";
import { appUrl, sendEmail } from "@/domains/email/email-service";
import { passwordResetEmail, welcomeEmail } from "@/domains/email/templates";
import { auditCollectionAction, auditUserAction } from "@/domains/audit/audit-service";
import { AUDIT_EVENTS } from "@/domains/audit/audit-events";
import { setFormFlash } from "@/lib/forms/form-flash";
import { normalizeTimeZone } from "@/lib/dates/user-timezone";

const passwordResetMinutes = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeReturnTo(value: string | null | undefined, fallback = "/dashboard") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function pathWithReturnTo(path: string, returnTo: string) {
  return returnTo === "/dashboard" ? path : `${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}`;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));
  const user = await prisma.user.findUnique({ where: { email }, include: { twoFactor: true } });

  if (!user || user.disabledAt || !(await verifyPassword(password, user.passwordHash))) {
    await auditUserAction({ entityType: "User", entityId: user?.id, action: AUDIT_EVENTS.LOGIN_FAILED, summary: "Login failed", actorEmail: email || null, severity: "WARNING", details: { reason: user?.disabledAt ? "account-disabled" : "invalid-credentials" } });
    redirect(`/login?error=invalid${returnTo !== "/dashboard" ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`);
  }

  if (user.twoFactor?.enabledAt) {
    await createTwoFactorChallenge(user.id);
    await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.TWO_FACTOR_CHALLENGE_STARTED, summary: `${user.name} started two-factor sign in`, actorUserId: user.id });
    redirect(pathWithReturnTo("/two-factor", returnTo));
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.LOGIN_SUCCEEDED, summary: `${user.name} logged in`, actorUserId: user.id });
  await createSession(user.id);
  redirect(user.serverRole === "SERVER_ADMIN" ? "/account/security?setup=required" : returnTo);
}

export async function verifyTwoFactorLogin(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));
  const challenge = await getTwoFactorChallenge();

  if (!challenge?.user.twoFactor?.enabledAt) redirect(pathWithReturnTo("/login?twoFactor=expired", returnTo));

  const secret = decryptTotpSecret(challenge.user.twoFactor.secretCiphertext);
  let method: "totp" | "recovery_code" = "totp";
  if (!verifyTotp(secret, code)) {
    const recoveryCode = await prisma.twoFactorRecoveryCode.findFirst({
      where: {
        userTwoFactorId: challenge.user.twoFactor.id,
        codeHash: hashRecoveryCode(code),
        usedAt: null
      }
    });
    if (!recoveryCode) redirect(pathWithReturnTo("/two-factor?error=invalid", returnTo));
    await prisma.twoFactorRecoveryCode.update({ where: { id: recoveryCode.id }, data: { usedAt: new Date() } });
    method = "recovery_code";
  }

  await consumeTwoFactorChallenge(challenge.id);
  await prisma.user.update({ where: { id: challenge.user.id }, data: { lastLoginAt: new Date() } });
  await createSession(challenge.user.id, { twoFactorVerifiedAt: new Date() });
  await auditUserAction({ entityType: "User", entityId: challenge.user.id, action: AUDIT_EVENTS.LOGIN_SUCCEEDED, summary: `${challenge.user.name} logged in with two-factor authentication`, actorUserId: challenge.user.id, metadata: { method } });
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
  let user = await getCurrentUser();
  const token = String(formData.get("token") ?? "");
  const invitation = await prisma.collectionInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { accountRequest: true } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) throw new Error("This invitation is no longer valid.");
  let shouldCreateSession = false;
  if (!user) {
    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email.toLowerCase() } });
    if (existingUser) throw new Error("Sign in with the invited email address to accept this invitation.");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? invitation.accountRequest?.name ?? "").trim();
    if (name.length < 2 || password.length < 12) throw new Error("Name and a 12-character password are required.");
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email: invitation.email.toLowerCase(), serverRole: invitation.accountRequest?.approvedServerRole ?? "STANDARD_USER", passwordHash: await hashPassword(password) } });
      await tx.collectionMembership.upsert({
        where: { collectionId_userId: { collectionId: invitation.collectionId, userId: created.id } },
        create: { collectionId: invitation.collectionId, userId: created.id, role: invitation.role },
        update: { role: invitation.role }
      });
      await tx.collectionInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
      if (invitation.accountRequest) await tx.accountRequest.update({ where: { id: invitation.accountRequest.id }, data: { invitedUserId: created.id } });
      return created;
    });
    shouldCreateSession = true;
  }
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) throw new Error("This invitation belongs to a different email address.");
  if (!shouldCreateSession) {
    await prisma.$transaction([
      prisma.collectionMembership.upsert({
        where: { collectionId_userId: { collectionId: invitation.collectionId, userId: user.id } },
        create: { collectionId: invitation.collectionId, userId: user.id, role: invitation.role },
        update: { role: invitation.role }
      }),
      prisma.collectionInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } }),
      ...(invitation.accountRequest ? [prisma.accountRequest.update({ where: { id: invitation.accountRequest.id }, data: { invitedUserId: user.id } })] : [])
    ]);
  }
  if (shouldCreateSession) await createSession(user.id);
  await auditCollectionAction({ collectionId: invitation.collectionId, entityType: "CollectionInvitation", entityId: invitation.id, action: AUDIT_EVENTS.INVITATION_ACCEPTED, after: { role: invitation.role }, actorUserId: user.id });
  if (shouldCreateSession && user.serverRole === "SERVER_ADMIN") redirect("/account/security?setup=required");
  redirect("/dashboard");
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const timezone = normalizeTimeZone(String(formData.get("timezone") || user.timezone || "America/New_York"));
  if (name.length < 2) throw new Error("Display name must be at least 2 characters.");
  const updated = await prisma.user.update({ where: { id: user.id }, data: { name, timezone } });
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, timezone },
    update: { timezone }
  });
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.USER_UPDATED, summary: `${updated.email} updated their profile`, before: { name: user.name, timezone: user.timezone }, after: { name: updated.name, timezone: updated.timezone }, actorUserId: user.id });
  revalidatePath("/settings");
  revalidatePath("/account");
  revalidatePath("/dashboard");
  await setFormFlash("Account profile saved.");
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

export async function confirmTwoFactorSetup(formData: FormData) {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "");
  const setup = await prisma.userTwoFactor.findUnique({ where: { userId: user.id } });
  if (!setup) redirect("/account/security?twoFactor=missing");

  const secret = decryptTotpSecret(setup.secretCiphertext);
  if (!verifyTotp(secret, code)) redirect("/account/security?twoFactor=invalid");

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction(async (tx) => {
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userTwoFactorId: setup.id } });
    await tx.userTwoFactor.update({
      where: { userId: user.id },
      data: {
        enabledAt: new Date(),
        recoveryCodesCiphertext: encryptRecoveryCodes(recoveryCodes),
        recoveryCodesGeneratedAt: new Date(),
        recoveryCodesViewedAt: null
      }
    });
    await tx.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({
        userTwoFactorId: setup.id,
        codeHash: hashRecoveryCode(recoveryCode)
      }))
    });
  });
  await markCurrentSessionTwoFactorVerified();
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.TWO_FACTOR_ENABLED, summary: `${user.email} enabled two-factor authentication`, actorUserId: user.id, severity: "WARNING" });
  redirect("/account/security?twoFactor=enabled");
}

export async function resetTwoFactorSetup() {
  const user = await requireUser();
  const existing = await prisma.userTwoFactor.findUnique({ where: { userId: user.id } });
  if (existing?.enabledAt && user.serverRole === "SERVER_ADMIN" && !user.twoFactorVerifiedAt) redirect("/login?twoFactor=expired");

  const secret = generateTotpSecret();
  await prisma.userTwoFactor.upsert({
    where: { userId: user.id },
    create: { userId: user.id, secretCiphertext: encryptTotpSecret(secret) },
    update: {
      secretCiphertext: encryptTotpSecret(secret),
      enabledAt: null,
      recoveryCodesCiphertext: null,
      recoveryCodesGeneratedAt: null,
      recoveryCodesViewedAt: null,
      recoveryCodes: { deleteMany: {} }
    }
  });
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.TWO_FACTOR_RESET, summary: `${user.email} reset two-factor setup`, actorUserId: user.id, severity: "WARNING" });
  redirect("/account/security?twoFactor=reset");
}

export async function regenerateRecoveryCodes() {
  const user = await requireUser();
  const setup = await prisma.userTwoFactor.findUnique({ where: { userId: user.id } });
  if (!setup?.enabledAt) redirect("/account/security?twoFactor=missing");
  if (user.serverRole === "SERVER_ADMIN" && !user.twoFactorVerifiedAt) redirect("/login?twoFactor=expired");

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction(async (tx) => {
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userTwoFactorId: setup.id } });
    await tx.userTwoFactor.update({
      where: { userId: user.id },
      data: {
        recoveryCodesCiphertext: encryptRecoveryCodes(recoveryCodes),
        recoveryCodesGeneratedAt: new Date(),
        recoveryCodesViewedAt: null
      }
    });
    await tx.twoFactorRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({
        userTwoFactorId: setup.id,
        codeHash: hashRecoveryCode(recoveryCode)
      }))
    });
  });

  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.TWO_FACTOR_RECOVERY_CODES_REGENERATED, summary: `${user.email} regenerated two-factor recovery codes`, actorUserId: user.id, severity: "WARNING" });
  redirect("/account/security?recoveryCodes=generated");
}

export async function dismissRecoveryCodes() {
  const user = await requireUser();
  await prisma.userTwoFactor.updateMany({
    where: { userId: user.id },
    data: { recoveryCodesCiphertext: null, recoveryCodesViewedAt: new Date() }
  });
  await auditUserAction({ entityType: "User", entityId: user.id, action: AUDIT_EVENTS.TWO_FACTOR_RECOVERY_CODES_SAVED, summary: `${user.email} confirmed two-factor recovery codes were saved`, actorUserId: user.id });
  redirect("/account/security");
}
