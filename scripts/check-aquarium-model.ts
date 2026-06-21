import { defaultAquariumEquipmentRole, isAttachableAquariumItem } from "../src/domains/aquariums/equipment-attachments";
import { habitatsForSalinity, speciesMatchesAquariumSalinity } from "../src/domains/species/habitat";

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
equal(defaultAquariumEquipmentRole("SUBSTRATE"), "SUBSTRATE", "substrate role");
equal(defaultAquariumEquipmentRole("EQUIPMENT", "AIR_PUMP"), "AERATION", "air pump role");
equal(isAttachableAquariumItem("EQUIPMENT"), true, "equipment attachable");
equal(isAttachableAquariumItem("FISH"), false, "livestock not attachable");

console.log("Aquarium classification, salinity, and equipment attachment checks passed.");
