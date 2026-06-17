"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createSession, destroySession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";

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

export async function logout() {
  await destroySession();
  redirect("/login");
}
