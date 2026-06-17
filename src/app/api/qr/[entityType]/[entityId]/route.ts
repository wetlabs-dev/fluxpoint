import { NextResponse } from "next/server";
import { ensureQrCode } from "@/domains/qr/qr-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  const { entityType, entityId } = await params;
  const qrCode = await ensureQrCode(entityType, entityId, `${entityType}:${entityId}`);
  return NextResponse.json({
    ...qrCode,
    labelPreview: `Fluxpoint label placeholder for ${qrCode.label}`
  });
}
