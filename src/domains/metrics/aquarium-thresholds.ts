import { prisma } from "@/lib/db/prisma";
import { commonMetricDefinitions } from "@/domains/metrics/metric-definitions";
import { ensureCollectionMetricDefinitions } from "@/domains/metrics/metric-definitions-service";

type Bound = { minValue: number | null; maxValue: number | null; unit: string };
type TargetAquarium = {
  targetSalinityMinPpt: number | null;
  targetSalinityMaxPpt: number | null;
  profile: {
    targetTemperature: number | null; targetTemperatureMin: number | null; targetTemperatureMax: number | null;
    targetPh: number | null; targetPhMin: number | null; targetPhMax: number | null;
    targetGh: number | null; targetGhMin: number | null; targetGhMax: number | null;
    targetKh: number | null; targetKhMin: number | null; targetKhMax: number | null;
    targetAmmoniaMin: number | null; targetAmmoniaMax: number | null;
    targetNitriteMin: number | null; targetNitriteMax: number | null;
    targetNitrateMin: number | null; targetNitrateMax: number | null;
  } | null;
};

const range = (min: number | null | undefined, max: number | null | undefined, unit: string): Bound => ({ minValue: min ?? null, maxValue: max ?? null, unit });
const centered = (target: number | null | undefined, min: number | null | undefined, max: number | null | undefined, spread: number, unit: string): Bound => range(min ?? (target == null ? null : Math.max(0, target - spread)), max ?? (target == null ? null : target + spread), unit);

export function deriveAquariumMetricThresholds(aquarium: TargetAquarium): Record<string, Bound> {
  const profile = aquarium.profile;
  return {
    temperature_f: centered(profile?.targetTemperature, profile?.targetTemperatureMin, profile?.targetTemperatureMax, 2, "F"),
    ph: centered(profile?.targetPh, profile?.targetPhMin, profile?.targetPhMax, 0.3, "pH"),
    salinity_ppt: range(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt, "ppt"),
    ammonia_ppm: range(profile?.targetAmmoniaMin ?? 0, profile?.targetAmmoniaMax ?? 0, "ppm"),
    nitrite_ppm: range(profile?.targetNitriteMin ?? 0, profile?.targetNitriteMax ?? 0, "ppm"),
    nitrate_ppm: range(profile?.targetNitrateMin ?? 0, profile?.targetNitrateMax ?? 40, "ppm"),
    gh_dgh: centered(profile?.targetGh, profile?.targetGhMin, profile?.targetGhMax, 2, "dGH"),
    kh_dkh: centered(profile?.targetKh, profile?.targetKhMin, profile?.targetKhMax, 2, "dKH")
  };
}

export async function upsertMetricThreshold(collectionId: string, aquariumId: string, metricDefinitionId: string, metricKey: string, minValue: number | null, maxValue: number | null) {
  const seed = commonMetricDefinitions.find((definition) => definition.key === metricKey);
  const existing = await prisma.aquariumMetricConfig.findUnique({ where: { aquariumId_metricDefinitionId: { aquariumId, metricDefinitionId } } });
  return prisma.aquariumMetricConfig.upsert({
    where: { aquariumId_metricDefinitionId: { aquariumId, metricDefinitionId } },
    create: { collectionId, aquariumId, metricDefinitionId, enabled: true, minValue, maxValue, displayOrder: seed?.displayOrder ?? 999, thresholdOverride: false },
    update: { collectionId, displayOrder: seed?.displayOrder ?? 999, ...(!existing?.thresholdOverride ? { minValue, maxValue } : {}) }
  });
}

export async function syncAquariumMetricThresholds(aquariumId: string) {
  const aquarium = await prisma.aquarium.findUniqueOrThrow({ where: { id: aquariumId }, select: { id: true, collectionId: true, targetSalinityMinPpt: true, targetSalinityMaxPpt: true, profile: true } });
  const definitions = await ensureCollectionMetricDefinitions(aquarium.collectionId);
  const derived = deriveAquariumMetricThresholds(aquarium);
  const configs = [];
  for (const definition of definitions) {
    const bound = derived[definition.key] ?? { minValue: definition.defaultMin, maxValue: definition.defaultMax, unit: definition.unit };
    configs.push(await upsertMetricThreshold(aquarium.collectionId, aquarium.id, definition.id, definition.key, bound.minValue ?? null, bound.maxValue ?? null));
  }
  return { configs, derived, updatedDerivedCount: configs.filter((config) => !config.thresholdOverride && derived[definitions.find((definition) => definition.id === config.metricDefinitionId)?.key ?? ""]).length };
}
