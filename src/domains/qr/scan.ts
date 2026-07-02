import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewCollection } from "@/domains/auth/permissions";
import { canonicalEntityPath, normalizeScannableEntityType, qrScanPath } from "@/domains/qr/qr-service";
import { publicAquariumPath } from "@/domains/public/public-utils";

export async function resolveQrScan(expectedType: string, publicCode: string) {
  const entityType = normalizeScannableEntityType(expectedType);
  const returnTo = qrScanPath(entityType, publicCode);
  const qr = await prisma.qrCode.findUnique({ where: { publicCode } });
  if (!qr || qr.entityType !== entityType) redirect("/q/access-denied");
  const user = await getCurrentUser();
  if (!user) {
    if (entityType === "TANK") {
      const aquarium = await prisma.aquarium.findUnique({ where: { id: qr.entityId }, include: { publicProfile: true, collection: { include: { publicProfile: true } } } });
      if (aquarium?.publicProfile?.isPublished && aquarium.collection.publicProfile?.isPublicEnabled && aquarium.collection.publicProfile.showQrLandingPages) redirect(publicAquariumPath(aquarium.collection.publicProfile.publicSlug, aquarium.publicProfile.publicSlug));
    }
    if (entityType === "INVENTORY" || entityType === "EQUIPMENT") {
      const item = await prisma.aquariumItem.findUnique({ where: { id: qr.entityId }, include: { publicProfile: true, aquarium: { include: { publicProfile: true, collection: { include: { publicProfile: true } } } }, aquariumAttachments: { include: { aquarium: { include: { publicProfile: true, collection: { include: { publicProfile: true } } } } } } } });
      const publicAquarium = item?.aquarium?.publicProfile?.isPublished ? item.aquarium : item?.aquariumAttachments.find((attachment) => attachment.aquarium.publicProfile?.isPublished)?.aquarium;
      if (item?.publicProfile?.isPublished && publicAquarium?.publicProfile?.isPublished && publicAquarium.collection.publicProfile?.isPublicEnabled && publicAquarium.collection.publicProfile.showQrLandingPages) redirect(`/public/q/${publicCode}`);
    }
    redirect("/q/access-denied");
  }
  if (!(await canViewCollection(user.id, qr.collectionId))) redirect("/q/access-denied");
  redirect(canonicalEntityPath(entityType, qr.entityId));
}
