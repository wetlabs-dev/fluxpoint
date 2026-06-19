import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();

type Failure = {
  id: string;
  message: string;
};

function isEmptyJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

async function main() {
  const failures: Failure[] = [];
  const guides = await prisma.speciesHusbandryGuide.findMany({
    include: {
      speciesDefinition: true,
      sourceSpeciesDefinition: { include: { husbandryGuide: true } }
    }
  });
  const overrides = await prisma.speciesHusbandryOverride.findMany({
    include: {
      aquariumItem: true,
      speciesDefinition: true
    }
  });

  const guideBySpecies = new Map(guides.map((guide) => [guide.speciesDefinitionId, guide]));

  for (const guide of guides) {
    if (guide.speciesDefinition.collectionId && guide.speciesDefinition.collectionId !== guide.collectionId) {
      failures.push({ id: guide.id, message: "Guide collection does not match species definition collection." });
    }
    if (guide.sourceSpeciesDefinitionId === guide.speciesDefinitionId) {
      failures.push({ id: guide.id, message: "Guide links to itself." });
    }
    if (guide.sourceSpeciesDefinitionId) {
      if (guide.status !== "LINKED") {
        failures.push({ id: guide.id, message: "Guide has a source link but is not marked LINKED." });
      }
      if (!isEmptyJsonObject(guide.fields) || guide.summary || guide.careDifficulty) {
        failures.push({ id: guide.id, message: "Linked guide contains local husbandry fields; fork it before editing." });
      }
      if (!guide.sourceSpeciesDefinition?.husbandryGuide) {
        failures.push({ id: guide.id, message: "Linked guide source has no husbandry guide." });
      } else if (guide.sourceSpeciesDefinition.husbandryGuide.collectionId !== guide.collectionId) {
        failures.push({ id: guide.id, message: "Linked guide source belongs to a different collection." });
      }
    }

    const seen = new Set<string>();
    let cursor: string | null = guide.speciesDefinitionId;
    while (cursor) {
      if (seen.has(cursor)) {
        failures.push({ id: guide.id, message: "Guide link cycle detected." });
        break;
      }
      seen.add(cursor);
      const linked = guideBySpecies.get(cursor);
      cursor = linked?.sourceSpeciesDefinitionId ?? null;
    }
  }

  for (const override of overrides) {
    if (override.aquariumItem.collectionId !== override.collectionId) {
      failures.push({ id: override.id, message: "Override collection does not match inventory item collection." });
    }
    if (override.speciesDefinition.collectionId && override.speciesDefinition.collectionId !== override.collectionId) {
      failures.push({ id: override.id, message: "Override collection does not match species definition collection." });
    }
    if (override.aquariumItem.speciesDefinitionId !== override.speciesDefinitionId) {
      failures.push({ id: override.id, message: "Override species does not match inventory item species." });
    }
  }

  if (failures.length) {
    console.error("Species husbandry integrity check failed:");
    for (const failure of failures) {
      console.error(`- ${failure.id}: ${failure.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Species husbandry integrity check passed for ${guides.length} guides and ${overrides.length} overrides.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
