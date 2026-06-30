import type { LabelType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { careRoles, requireCollectionRole } from "@/domains/auth/permissions";
import { generateLabel } from "@/domains/labels/label-service";
import { labelTypeLabels } from "@/domains/labels/label-types";
import { normalizeLabelFormat, normalizeLabelMode, normalizeLabelOrientation } from "@/domains/labels/label-formats";

export async function POST(request: Request) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, careRoles);
  try {
    const body = await request.json().catch(() => ({}));
    const labelMode = normalizeLabelMode(body.labelMode);
    const requestedLabelType = String(body.labelType || "") as LabelType;
    const labelType = labelMode === "QR_ONLY" ? "SIMPLE_QR" : requestedLabelType;
    if (!(labelType in labelTypeLabels)) return NextResponse.json({ error: "Choose a supported label type." }, { status: 400 });
    const format = normalizeLabelFormat(body.printFormat, labelMode);
    const orientation = normalizeLabelOrientation(body.orientation, format);
    const label = await generateLabel({ collectionId: collection.id, userId: user.id, entityType: String(body.entityType || ""), entityId: String(body.entityId || ""), labelType, printOptions: { mode: labelMode, format, orientation } });
    return NextResponse.json({ id: label.id, filename: label.filename, labelType: label.labelType, downloadUrl: `/api/labels/${label.id}` }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Label generation failed." }, { status: 400 });
  }
}
