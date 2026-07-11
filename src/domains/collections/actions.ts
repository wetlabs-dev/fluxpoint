"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { canViewCollection } from "@/domains/auth/permissions";

const safeListRoutes = new Set(["/dashboard", "/aquariums", "/species", "/inventory", "/equipment", "/storage", "/quarantine", "/breeding", "/conditions", "/medications", "/schedules", "/lighting-schedules", "/workflows", "/planning", "/emergency-response", "/intelligence", "/metrics", "/labels", "/collection", "/account", "/help", "/server-maintenance", "/server-maintenance/account-requests", "/server-maintenance/ai-jobs", "/server-maintenance/audit-log", "/server-maintenance/collections", "/server-maintenance/data-reset", "/server-maintenance/users"]);

export async function switchActiveCollection(formData: FormData) {
  const user = await requireUser();
  const collectionId = String(formData.get("collectionId") || "");
  const activeCollection = collectionId ? await prisma.collection.findFirst({ where: { id: collectionId, archivedAt: null }, select: { id: true } }) : null;
  if (!activeCollection || !(await canViewCollection(user.id, collectionId))) throw new Error("You cannot access that collection.");
  await prisma.user.update({ where: { id: user.id }, data: { activeCollectionId: collectionId } });
  const requestedPath = String(formData.get("returnTo") || "");
  redirect(safeListRoutes.has(requestedPath) ? requestedPath : "/dashboard");
}
