"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { createMetricIngestionToken } from "@/domains/metrics/metrics-service";
import { ensureAquariumDashboard } from "@/domains/metrics/grafana-service";

function nullableNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error("Metric threshold must be a number.");
  return number;
}

export async function updateAquariumMetricConfig(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const id = String(formData.get("id") ?? "");
  const config = await prisma.aquariumMetricConfig.findFirstOrThrow({
    where: { id, collectionId: collection.id },
    include: { aquarium: true }
  });

  await prisma.aquariumMetricConfig.update({
    where: { id },
    data: {
      enabled: formData.get("enabled") === "on",
      minValue: nullableNumber(formData.get("minValue")),
      maxValue: nullableNumber(formData.get("maxValue"))
    }
  });

  await prisma.metricSyncLog.create({
    data: {
      collectionId: collection.id,
      aquariumId: config.aquariumId,
      action: "UPDATE_METRIC_CONFIG",
      status: "SUCCEEDED",
      message: "Metric thresholds or enabled state updated."
    }
  });

  revalidatePath(`/aquariums/${config.aquariumId}`);
  revalidatePath("/metrics");
}

export async function createAquariumMetricToken(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const aquariumId = String(formData.get("aquariumId") ?? "");
  const name = String(formData.get("name") ?? "Aquarium sensor token").trim() || "Aquarium sensor token";
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const { token } = await createMetricIngestionToken({ collectionId: collection.id, aquariumId: aquarium.id, name });

  await prisma.metricSyncLog.create({
    data: {
      collectionId: collection.id,
      aquariumId: aquarium.id,
      action: "CREATE_INGESTION_TOKEN",
      status: "SUCCEEDED",
      message: `Created ingestion token ${name}.`
    }
  });

  revalidatePath(`/aquariums/${aquarium.id}`);
  redirect(`/aquariums/${aquarium.id}?workspace=metrics&metricToken=${encodeURIComponent(token)}#workspace`);
}

export async function syncAquariumMetricsDashboard(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const aquariumId = String(formData.get("aquariumId") ?? "");
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  await ensureAquariumDashboard(aquarium.id);

  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/metrics");
}
