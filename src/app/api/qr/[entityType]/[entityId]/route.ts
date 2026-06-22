import { NextResponse } from "next/server";
import { ensureQrCode } from "@/domains/qr/qr-service";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { careRoles, requireCollectionRole } from "@/domains/auth/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, careRoles);
  const { entityType, entityId } = await params;
  const qrCode = await ensureQrCode({ collectionId: collection.id, entityType, entityId });
  return NextResponse.json(qrCode);
}
