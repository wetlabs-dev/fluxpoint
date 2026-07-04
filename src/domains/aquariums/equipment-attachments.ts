import type { AquariumEquipmentRole, EquipmentType, ItemType } from "@prisma/client";

export const aquariumEquipmentRoles: AquariumEquipmentRole[] = [
  "AQUARIUM_VESSEL", "LIGHT", "FILTER", "HEATER", "SUBSTRATE", "CO2", "AERATION", "CONTROLLER",
  "PUMP", "CHILLER", "UV", "DOSER", "AUTO_TOP_OFF", "MONITOR", "OTHER"
];

export const aquariumEquipmentRoleLabels: Record<AquariumEquipmentRole, string> = {
  AQUARIUM_VESSEL: "Physical tank / vessel",
  LIGHT: "Lighting",
  FILTER: "Filtration",
  HEATER: "Heating",
  SUBSTRATE: "Substrate",
  CO2: "CO₂",
  AERATION: "Aeration",
  CONTROLLER: "Controllers",
  PUMP: "Pumps",
  CHILLER: "Chillers",
  UV: "UV",
  DOSER: "Dosers",
  AUTO_TOP_OFF: "Auto top-off",
  MONITOR: "Monitoring",
  OTHER: "Other equipment"
};

export function defaultAquariumEquipmentRole(itemType: ItemType | string, equipmentType?: EquipmentType | string | null): AquariumEquipmentRole {
  if (itemType === "SUBSTRATE") return "SUBSTRATE";
  if (equipmentType === "AQUARIUM_VESSEL") return "AQUARIUM_VESSEL";
  if (equipmentType === "LIGHT") return "LIGHT";
  if (equipmentType === "FILTER") return "FILTER";
  if (equipmentType === "HEATER") return "HEATER";
  if (equipmentType === "CO2") return "CO2";
  if (equipmentType === "AIR_PUMP") return "AERATION";
  if (equipmentType === "CONTROLLER") return "CONTROLLER";
  if (equipmentType === "PUMP") return "PUMP";
  if (equipmentType === "DOSER") return "DOSER";
  if (equipmentType === "SENSOR") return "MONITOR";
  return "OTHER";
}

export function isAttachableAquariumItem(itemType: ItemType | string) {
  return itemType === "EQUIPMENT" || itemType === "SUBSTRATE";
}
