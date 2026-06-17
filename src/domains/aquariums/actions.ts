"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { aquariumFormSchema } from "@/lib/validation/aquarium";
import { writeAuditLog } from "@/domains/audit/audit-log";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getDefaultCollectionId() {
  const collection = await prisma.collection.findFirst({ orderBy: { createdAt: "asc" } });
  if (collection) return collection.id;

  const user = await prisma.user.upsert({
    where: { email: "keeper@fluxpoint.local" },
    update: {},
    create: { name: "Fluxpoint Keeper", email: "keeper@fluxpoint.local" }
  });

  const created = await prisma.collection.create({
    data: {
      name: "Home Aquariums",
      description: "Default local collection",
      ownerId: user.id
    }
  });
  return created.id;
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
  const parsed = aquariumFormSchema.parse(Object.fromEntries(formData));
  const collectionId = await getDefaultCollectionId();
  const slug = await uniqueSlug(parsed.name);

  const aquarium = await prisma.aquarium.create({
    data: {
      collectionId,
      name: parsed.name,
      generatedName: parsed.generatedName || null,
      slug,
      description: parsed.description || null,
      tankType: parsed.tankType,
      volumeGallons: parsed.volumeGallons ?? null,
      lengthInches: parsed.lengthInches ?? null,
      widthInches: parsed.widthInches ?? null,
      heightInches: parsed.heightInches ?? null,
      location: parsed.location || null,
      status: parsed.status,
      notes: parsed.notes || null,
      coverCardStyle: JSON.stringify({
        palette: ["#123f46", "#7a9d76", "#dac084"],
        mood: "new aquarium plan",
        motif: "waterline with young plant growth",
        typographyStyle: "clean rounded sans",
        backgroundType: "soft gradient",
        accentIllustrations: ["bubbles", "sand ripple"],
        promptText: `A calm Fluxpoint cover card for ${parsed.name}.`
      })
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "CREATE",
    after: aquarium
  });

  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
  redirect(`/aquariums/${aquarium.id}`);
}

export async function updateAquarium(formData: FormData) {
  const parsed = aquariumFormSchema.parse(Object.fromEntries(formData));
  if (!parsed.id) throw new Error("Missing aquarium id.");

  const before = await prisma.aquarium.findUniqueOrThrow({ where: { id: parsed.id } });
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
      location: parsed.location || null,
      status: parsed.status,
      notes: parsed.notes || null
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "UPDATE",
    before,
    after: aquarium
  });

  revalidatePath("/aquariums");
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
}

export async function selectAiSuggestion(formData: FormData) {
  const aquariumId = String(formData.get("aquariumId"));
  const suggestionType = String(formData.get("suggestionType"));
  const value = String(formData.get("value"));

  if (suggestionType === "TANK_NAME") {
    await prisma.aquarium.update({
      where: { id: aquariumId },
      data: { generatedName: value }
    });
  }

  if (suggestionType === "COVER_CARD") {
    await prisma.aquarium.update({
      where: { id: aquariumId },
      data: { coverCardStyle: value }
    });
  }

  await prisma.aiSuggestion.create({
    data: {
      aquariumId,
      suggestionType: suggestionType as "TANK_NAME" | "COVER_CARD",
      prompt: "Local mock AI Studio selection",
      response: suggestionType === "COVER_CARD" ? value : JSON.stringify({ name: value }),
      selected: true
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquariumId,
    action: `SELECT_${suggestionType}`,
    after: { value }
  });

  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}
