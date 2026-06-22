import { prisma } from "@/lib/db/prisma";
import { commonMetricDefinitions } from "@/domains/metrics/metric-definitions";

export async function ensureCollectionMetricDefinitions(collectionId: string) {
  const definitions = [];
  for (const definition of commonMetricDefinitions) {
    definitions.push(await prisma.metricDefinition.upsert({
      where: { collectionId_key: { collectionId, key: definition.key } },
      update: { displayName: definition.displayName, description: definition.description, parameter: definition.parameter, unit: definition.unit, prometheusName: definition.prometheusName, defaultMin: definition.defaultMin ?? null, defaultMax: definition.defaultMax ?? null, enabledByDefault: true },
      create: { collectionId, key: definition.key, displayName: definition.displayName, description: definition.description, parameter: definition.parameter, unit: definition.unit, prometheusName: definition.prometheusName, defaultMin: definition.defaultMin ?? null, defaultMax: definition.defaultMax ?? null, enabledByDefault: true }
    }));
  }
  return definitions;
}
