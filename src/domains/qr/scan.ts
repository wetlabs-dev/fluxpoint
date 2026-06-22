import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewCollection } from "@/domains/auth/permissions";
import { canonicalEntityPath, normalizeScannableEntityType, qrScanPath } from "@/domains/qr/qr-service";

export async function resolveQrScan(expectedType: string, publicCode: string) {
  const entityType = normalizeScannableEntityType(expectedType);
  const returnTo = qrScanPath(entityType, publicCode);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  const qr = await prisma.qrCode.findUnique({ where: { publicCode } });
  if (!qr || qr.entityType !== entityType) redirect("/q/access-denied");
  if (!(await canViewCollection(user.id, qr.collectionId))) redirect("/q/access-denied");
  redirect(canonicalEntityPath(entityType, qr.entityId));
}
