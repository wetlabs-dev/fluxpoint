import { prisma } from "@/lib/db/prisma";

export async function isServerAdmin(user: { id: string; email: string }) {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configured) return user.email.toLowerCase() === configured;
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return firstUser?.id === user.id;
}

export async function requireServerAdmin(user: { id: string; email: string }) {
  if (!(await isServerAdmin(user))) throw new Error("Server administrator access is required.");
}
