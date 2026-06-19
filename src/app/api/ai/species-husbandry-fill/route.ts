import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { buildScientificDisplayName } from "@/lib/format/species";
import { getHusbandryFieldsForSpeciesType, inferSpeciesHusbandryType, normalizeHusbandryFields, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";

const responsesUrl = "https://api.openai.com/v1/responses";

function mockDraft(type: HusbandrySpeciesType) {
  const fields: Record<string, string | null> = Object.fromEntries(getHusbandryFieldsForSpeciesType(type).map((field) => [field.key, null]));
  if ("temperatureRange" in fields) fields.temperatureRange = "Use a broad, species-appropriate range; verify with trusted references.";
  if ("dietType" in fields) fields.dietType = "Varied diet; verify species-specific needs.";
  if ("lightRequirement" in fields) fields.lightRequirement = "Moderate; verify for the exact species or cultivar.";
  if ("careDifficulty" in fields) fields.careDifficulty = "Moderate";
  return fields;
}

export async function POST(request: Request) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const body = await request.json().catch(() => ({}));
  const speciesDefinitionId = String(body.speciesDefinitionId ?? "");
  const definition = await prisma.speciesDefinition.findFirst({
    where: { id: speciesDefinitionId, OR: [{ collectionId: collection.id }, { collectionId: null }] }
  });
  if (!definition) return NextResponse.json({ error: "Species definition not found." }, { status: 404 });
  const speciesType = String(body.speciesType || inferSpeciesHusbandryType(definition)) as HusbandrySpeciesType;
  const status = aiProviderStatus();
  const log = await prisma.aiRequestLog.create({
    data: {
      collectionId: collection.id,
      userId: user.id,
      requestType: "OTHER",
      provider: status.provider,
      model: status.responsesModel,
      promptSummary: `Species husbandry: ${definition.commonName}`,
      input: { speciesDefinitionId, speciesType } as never
    }
  });

  try {
    let fields: Record<string, string | null>;
    if (status.provider !== "openai" || !process.env.OPENAI_API_KEY || process.env.AI_ENABLED === "false") {
      fields = mockDraft(speciesType);
    } else {
      const keys = getHusbandryFieldsForSpeciesType(speciesType).map((field) => field.key);
      const prompt = {
        task: "Draft aquarium species husbandry guidance as JSON only.",
        safety: [
          "Return concise strings or null for each key.",
          "Do not invent exact water values unless broadly established; use broad ranges or null if uncertain.",
          "For medications, disease, and dosing-related text, stay general and advise verifying labels or professional sources.",
          "The user must review before saving."
        ],
        species: {
          commonName: definition.commonName,
          scientificName: buildScientificDisplayName(definition),
          category: definition.category,
          type: speciesType,
          notes: definition.notes ?? definition.careNotes
        },
        keys,
        jsonShape: Object.fromEntries(keys.map((key) => [key, "string|null"]))
      };
      const response = await fetch(responsesUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini",
          input: [
            { role: "system", content: "You are a careful aquarium husbandry assistant. Return only parseable JSON." },
            { role: "user", content: JSON.stringify(prompt) }
          ],
          temperature: 0.25
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "OpenAI husbandry fill failed.");
      const text = payload.output_text ?? payload.output?.flatMap((item: any) => item.content ?? []).find((content: any) => content.text)?.text ?? "{}";
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      fields = JSON.parse(text.slice(start, end + 1));
    }
    const normalized = normalizeHusbandryFields(speciesType, fields);
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "SUCCEEDED", output: normalized as never, completedAt: new Date() } });
    return NextResponse.json({ speciesType, fields: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
