import { defaultAquariumEquipmentRole, isAttachableAquariumItem } from "../src/domains/aquariums/equipment-attachments";
import { habitatsForSalinity, speciesMatchesAquariumSalinity, speciesMatchesAquariumTarget } from "../src/domains/species/habitat";
import { deriveAquariumMetricThresholds } from "../src/domains/metrics/aquarium-thresholds";

function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

equal(habitatsForSalinity(0, 0.5), ["Freshwater", "Brackish"], "freshwater boundary overlap");
equal(habitatsForSalinity(0, 2), ["Freshwater", "Brackish"], "freshwater and brackish range");
equal(habitatsForSalinity(10, 35), ["Brackish", "Marine"], "brackish and marine range");
equal(habitatsForSalinity(0, 35), ["Freshwater", "Brackish", "Marine"], "all habitat range");
equal(speciesMatchesAquariumSalinity("MARINE", 10, 35), true, "marine compatibility");
equal(speciesMatchesAquariumSalinity("FRESHWATER", 10, 35), false, "freshwater incompatibility");
equal(speciesMatchesAquariumSalinity("BRACKISH", null, null), false, "unknown range is not assignable");
equal(speciesMatchesAquariumTarget(0, 0.5, 0, 0.5), true, "target range compatibility");
equal(speciesMatchesAquariumTarget(30, 40, 0, 0.5), false, "target range incompatibility");
const thresholds = deriveAquariumMetricThresholds({ targetSalinityMinPpt: 0, targetSalinityMaxPpt: 0.5, profile: { targetTemperature: 76, targetTemperatureMin: null, targetTemperatureMax: null, targetPh: 7, targetPhMin: null, targetPhMax: null, targetGh: 8, targetGhMin: null, targetGhMax: null, targetKh: 1, targetKhMin: null, targetKhMax: null, targetAmmoniaMin: null, targetAmmoniaMax: null, targetNitriteMin: null, targetNitriteMax: null, targetNitrateMin: null, targetNitrateMax: null } });
equal([thresholds.ammonia_ppm.minValue, thresholds.ammonia_ppm.maxValue], [0, 0], "ammonia defaults");
equal([thresholds.nitrite_ppm.minValue, thresholds.nitrite_ppm.maxValue], [0, 0], "nitrite defaults");
equal([thresholds.nitrate_ppm.minValue, thresholds.nitrate_ppm.maxValue], [0, 40], "nitrate defaults");
equal([thresholds.gh_dgh.minValue, thresholds.gh_dgh.maxValue], [6, 10], "GH target spread");
equal([thresholds.kh_dkh.minValue, thresholds.kh_dkh.maxValue], [0, 3], "KH target spread clamps at zero");
equal([thresholds.salinity_ppt.minValue, thresholds.salinity_ppt.maxValue], [0, 0.5], "salinity target thresholds");
equal(defaultAquariumEquipmentRole("SUBSTRATE"), "SUBSTRATE", "substrate role");
equal(defaultAquariumEquipmentRole("EQUIPMENT", "AIR_PUMP"), "AERATION", "air pump role");
equal(isAttachableAquariumItem("EQUIPMENT"), true, "equipment attachable");
equal(isAttachableAquariumItem("FISH"), false, "livestock not attachable");

console.log("Aquarium classification, salinity, and equipment attachment checks passed.");
