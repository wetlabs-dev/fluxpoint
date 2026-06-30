"use server";

import type { LabelType } from "@prisma/client";
import { redirect } from "next/navigation";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { careRoles, requireCollectionRole } from "@/domains/auth/permissions";
import { generateBulkLabels, type BulkLabelEntity } from "@/domains/labels/label-service";
import { labelTypeLabels } from "@/domains/labels/label-types";
import { normalizeScannableEntityType } from "@/domains/qr/qr-service";
import { setFormFlash } from "@/lib/forms/form-flash";

export async function generateBulkLabelsAction(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, careRoles);
  const labelType = String(formData.get("labelType") || "SIMPLE_QR") as LabelType;
  if (!(labelType in labelTypeLabels)) throw new Error("Choose a supported label type.");
  const entities: BulkLabelEntity[] = formData.getAll("record").flatMap((raw) => {
    const [type, id] = String(raw).split(":");
    if (!type || !id) return [];
    return [{ entityType: normalizeScannableEntityType(type), entityId: id }];
  });
  const record = await generateBulkLabels({
    collectionId: collection.id,
    userId: user.id,
    labelType,
    entities,
    summary: String(formData.get("batchSummary") || "")
  });
  await setFormFlash(`Generated label batch: ${labelTypeLabels[labelType]}.`);
  redirect(`/labels?generated=${record.id}`);
}
