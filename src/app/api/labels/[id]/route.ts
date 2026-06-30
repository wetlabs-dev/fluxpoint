import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { canViewCollection, collectionOwnerRoles, requireCollectionRole } from "@/domains/auth/permissions";
import { deleteGeneratedLabelFile, readGeneratedLabel } from "@/domains/labels/label-service";
import { writeAuditLog } from "@/domains/audit/audit-log";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to download this label." }, { status: 401 });
  const { id } = await params;
  const label = await prisma.generatedLabel.findUnique({ where: { id } });
  if (!label || !(await canViewCollection(user.id, label.collectionId))) return NextResponse.json({ error: "Label not found." }, { status: 404 });
  const file = await readGeneratedLabel(label.storagePath).catch(() => null);
  if (!file) return NextResponse.json({ error: "Label file is unavailable." }, { status: 404 });
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(file, { headers: { "content-type": "application/pdf", "content-disposition": `${disposition}; filename="${label.filename.replaceAll('"', '')}"`, "cache-control": "private, no-store" } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const label = await prisma.generatedLabel.findUnique({ where: { id } });
  if (!label) return NextResponse.json({ error: "Label not found." }, { status: 404 });
  await requireCollectionRole(label.collectionId, collectionOwnerRoles);
  await deleteGeneratedLabelFile(label.storagePath);
  await prisma.generatedLabel.delete({ where: { id } });
  await writeAuditLog({ collectionId: label.collectionId, entityType: label.entityType, entityId: label.entityId, action: "LABEL_DELETED", before: label, createdById: user.id });
  return NextResponse.json({ ok: true });
}
