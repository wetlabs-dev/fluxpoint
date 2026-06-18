"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { aquariumFormSchema } from "@/lib/validation/aquarium";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { generateTankCoverImage } from "@/domains/ai/ai-service";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(name: string, ignoreId?: string) {
  const base = slugify(name) || "aquarium";
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await prisma.aquarium.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${index}`;
    index += 1;
  }
}

export async function createAquarium(formData: FormData) {
  const user = await requireUser();
  const parsed = aquariumFormSchema.parse(Object.fromEntries(formData));
  const collection = await getUserCollection(user.id);
  const slug = await uniqueSlug(parsed.name);

  const aquarium = await prisma.aquarium.create({
    data: {
      collectionId: collection.id,
      name: parsed.name,
      generatedName: parsed.generatedName || null,
      slug,
      description: parsed.description || null,
      tankType: parsed.tankType,
      volumeGallons: parsed.volumeGallons ?? null,
      lengthInches: parsed.lengthInches ?? null,
      widthInches: parsed.widthInches ?? null,
      heightInches: parsed.heightInches ?? null,
      locationId: parsed.locationId || null,
      status: parsed.status,
      startedAt: parsed.startedAt ?? null,
      notes: parsed.notes || null,
      profile: {
        create: {
          substrateItemId: parsed.substrateItemId || null,
          lightItemId: parsed.lightItemId || null,
          heaterItemId: parsed.heaterItemId || null,
          filtration: parsed.filtration || null,
          heating: null,
          waterSource: parsed.waterSource || null,
          targetTemperature: parsed.targetTemperature ?? null,
          targetPh: parsed.targetPh ?? null,
          targetGh: parsed.targetGh ?? null,
          targetKh: parsed.targetKh ?? null,
          notes: parsed.notes || null
        }
      },
      coverCardStyle: {
        palette: ["#123f46", "#7a9d76", "#dac084"],
        mood: "new aquarium plan",
        motif: "waterline with young plant growth",
        typographyStyle: "clean rounded sans",
        backgroundType: "soft gradient",
        accentIllustrations: ["bubbles", "sand ripple"],
        promptText: `A calm Fluxpoint cover card for ${parsed.name}.`
      }
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "CREATE",
    after: aquarium,
    createdById: user.id
  });

  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
  redirect(`/aquariums/${aquarium.id}`);
}

export async function updateAquarium(formData: FormData) {
  const user = await requireUser();
  const parsed = aquariumFormSchema.parse(Object.fromEntries(formData));
  if (!parsed.id) throw new Error("Missing aquarium id.");

  const collection = await getUserCollection(user.id);
  const before = await prisma.aquarium.findFirstOrThrow({ where: { id: parsed.id, collectionId: collection.id }, include: { profile: true } });
  const slug = await uniqueSlug(parsed.name, parsed.id);
  const aquarium = await prisma.aquarium.update({
    where: { id: parsed.id },
    data: {
      name: parsed.name,
      generatedName: parsed.generatedName || null,
      slug,
      description: parsed.description || null,
      tankType: parsed.tankType,
      volumeGallons: parsed.volumeGallons ?? null,
      lengthInches: parsed.lengthInches ?? null,
      widthInches: parsed.widthInches ?? null,
      heightInches: parsed.heightInches ?? null,
      locationId: parsed.locationId || null,
      status: parsed.status,
      startedAt: parsed.startedAt ?? null,
      notes: parsed.notes || null,
      profile: {
        upsert: {
          create: {
            substrateItemId: parsed.substrateItemId || null,
            lightItemId: parsed.lightItemId || null,
            heaterItemId: parsed.heaterItemId || null,
            filtration: parsed.filtration || null,
            heating: null,
            waterSource: parsed.waterSource || null,
            targetTemperature: parsed.targetTemperature ?? null,
            targetPh: parsed.targetPh ?? null,
            targetGh: parsed.targetGh ?? null,
            targetKh: parsed.targetKh ?? null,
            notes: parsed.notes || null
          },
          update: {
            substrateItemId: parsed.substrateItemId || null,
            lightItemId: parsed.lightItemId || null,
            heaterItemId: parsed.heaterItemId || null,
            filtration: parsed.filtration || null,
            heating: null,
            waterSource: parsed.waterSource || null,
            targetTemperature: parsed.targetTemperature ?? null,
            targetPh: parsed.targetPh ?? null,
            targetGh: parsed.targetGh ?? null,
            targetKh: parsed.targetKh ?? null,
            notes: parsed.notes || null
          }
        }
      }
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "UPDATE",
    before,
    after: aquarium,
    createdById: user.id
  });

  revalidatePath("/aquariums");
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
}

export async function archiveAquarium(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const id = String(formData.get("id"));
  const before = await prisma.aquarium.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const aquarium = await prisma.aquarium.update({ where: { id }, data: { status: "ARCHIVED" } });
  await writeAuditLog({
    entityType: "Aquarium",
    entityId: id,
    action: "ARCHIVE",
    before,
    after: aquarium,
    createdById: user.id
  });
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
}

export async function selectAiSuggestion(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const aquariumId = String(formData.get("aquariumId"));
  const suggestionType = String(formData.get("suggestionType"));
  const value = String(formData.get("value"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });

  if (suggestionType === "TANK_NAME") {
    await prisma.aquarium.update({
      where: { id: aquariumId },
      data: { generatedName: value }
    });
  }

  if (suggestionType === "COVER_CARD") {
    await prisma.aquarium.update({
      where: { id: aquariumId },
      data: { coverCardStyle: JSON.parse(value) }
    });
  }

  await prisma.aiSuggestion.create({
    data: {
      aquariumId,
      suggestionType: suggestionType as never,
      prompt: "Local mock AI Studio selection",
      response: suggestionType === "COVER_CARD" || suggestionType === "CARE_ADVICE" ? JSON.parse(value) : { name: value },
      selected: true
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquariumId,
    action: `SELECT_${suggestionType}`,
    after: { value },
    createdById: user.id
  });

  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function generateAiCoverImage(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const aquariumId = String(formData.get("aquariumId"));
  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId: collection.id },
    include: {
      profile: true,
      items: { where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" } },
      readings: { orderBy: { measuredAt: "desc" }, take: 8 },
      events: { orderBy: { eventDate: "desc" }, take: 6 }
    }
  });

  const cover = await generateTankCoverImage({
    collectionId: collection.id,
    aquariumId: aquarium.id,
    userId: user.id,
    name: aquarium.generatedName ?? aquarium.name,
    volumeGallons: aquarium.volumeGallons,
    tankType: aquarium.tankType,
    stocking: aquarium.items.filter((item) => ["FISH", "INVERT"].includes(item.itemType)).map((item) => item.name),
    plants: aquarium.items.filter((item) => item.itemType === "PLANT").map((item) => item.name),
    hardscape: aquarium.items.filter((item) => item.itemType === "HARDSCAPE").map((item) => item.name),
    substrate: aquarium.profile?.substrate,
    lighting: aquarium.profile?.lightingType,
    vibeNotes: aquarium.profile?.notes ?? aquarium.notes,
    latestParameters: aquarium.readings.map((reading) => ({ parameter: reading.parameter, value: reading.value, unit: reading.unit })),
    recentEvents: aquarium.events.map((event) => ({ eventType: event.eventType, title: event.title, summary: event.summary }))
  });

  await prisma.aquarium.update({
    where: { id: aquarium.id },
    data: { coverImageUrl: cover.url }
  });

  await prisma.aiSuggestion.create({
    data: {
      aquariumId: aquarium.id,
      suggestionType: "COVER_CARD",
      prompt: cover.prompt,
      response: cover as never,
      selected: true
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "GENERATE_AI_COVER_IMAGE",
    after: cover,
    createdById: user.id
  });

  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
}
