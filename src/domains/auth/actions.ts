"use server";

import { createHash, randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { appUrl, sendEmail } from "@/domains/email/email-service";
import { passwordResetEmail, welcomeEmail } from "@/domains/email/templates";

const passwordResetMinutes = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);
  redirect("/dashboard");
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
  redirect("/login?reset=1");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Display name must be at least 2 characters.");
  await prisma.user.update({ where: { id: user.id }, data: { name } });
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
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await destroySession();
  redirect("/login");
}
