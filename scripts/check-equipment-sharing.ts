import { readFileSync, existsSync } from "fs";

const checks: Array<[string, string | RegExp, string]> = [
  ["prisma/schema.prisma", /multiAquariumCapable\s+Boolean\s+@default\(false\)/, "EquipmentProfile has the shared-capable flag"],
  ["prisma/migrations/20260702120000_equipment_sharing/migration.sql", "\"multiAquariumCapable\" BOOLEAN NOT NULL DEFAULT false", "migration adds the shared-capable column"],
  ["src/domains/management/actions.ts", "export async function duplicateEquipment", "equipment duplication action exists"],
  ["src/domains/management/actions.ts", "multiAssignmentConfirmed", "multi-aquarium override confirmation is enforced"],
  ["src/domains/management/actions.ts", "EQUIPMENT_DUPLICATED", "equipment duplication is audited"],
  ["src/domains/management/actions.ts", "EQUIPMENT_MULTI_ASSIGNMENT_OVERRIDE_CONFIRMED", "multi-tank override is audited"],
  ["src/components/equipment/EquipmentForm.tsx", "Can serve multiple aquariums", "equipment form exposes shared-capable setting"],
  ["src/components/equipment/AquariumEquipmentAttachForm.tsx", "Confirm multi-aquarium assignment", "aquarium attach flow confirms non-shared multi-assignment"],
  ["src/components/equipment/AquariumEquipmentAttachForm.tsx", "Duplicate & attach", "aquarium attach flow can duplicate a model"],
  ["src/app/(app)/equipment/page.tsx", "Shared across", "equipment list surfaces shared assignments"],
  ["src/components/inventory/InventoryDetailWorkspace.tsx", "Duplicate equipment", "equipment detail has duplication action"],
  ["src/domains/labels/label-service.ts", "Shared equipment", "labels handle shared equipment placement"],
  ["docs/product/equipment.md", "Can serve multiple aquariums", "equipment docs explain shared-capable flag"],
  ["docs/product/aquariums.md", "duplicate an existing equipment model", "aquarium docs explain duplicate-and-attach"],
  ["docs/product/inventory.md", "Duplicating equipment creates a new inventory item", "inventory docs explain duplication semantics"]
];

const failures: string[] = [];

for (const [file, needle, description] of checks) {
  if (!existsSync(file)) {
    failures.push(`${description}: missing ${file}`);
    continue;
  }
  const contents = readFileSync(file, "utf8");
  const passed = typeof needle === "string" ? contents.includes(needle) : needle.test(contents);
  if (!passed) failures.push(`${description}: did not find ${needle.toString()} in ${file}`);
}

if (failures.length) {
  console.error("Equipment sharing checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Equipment sharing checks passed (${checks.length}).`);
