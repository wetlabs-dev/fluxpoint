import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionRole } from "@/domains/auth/permissions";
import { renderTankAuditWorksheet } from "@/domains/tank-audits/tank-audit-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; auditId: string }> }) {
  const [{ id, auditId }, user] = await Promise.all([params, requireUser()]);
  const collection = await getUserCollection(user.id);
  if (!(await getCollectionRole(user.id, collection.id))) notFound();
  const bytes = await renderTankAuditWorksheet({ collectionId: collection.id, aquariumId: id, auditId, userId: user.id });
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="tank-audit-${auditId}.pdf"`, "cache-control": "private, no-store" } });
}
