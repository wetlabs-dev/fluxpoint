import type { LabelType } from "@prisma/client";

export const individualLabelTypes: LabelType[] = ["SIMPLE_QR", "ENTITY_DETAIL", "EQUIPMENT_DETAIL", "TANK_DETAIL"];
export const labelTypeLabels: Record<LabelType, string> = {
  SIMPLE_QR: "Simple QR",
  ENTITY_DETAIL: "Detail label",
  EQUIPMENT_DETAIL: "Equipment label",
  TANK_DETAIL: "Tank label",
  AQUARIUM_LIVESTOCK_SHEET: "Livestock detail sheet"
};

export type LabelEntityDetails = {
  entityType: "TANK" | "INVENTORY" | "EQUIPMENT" | "SPECIES";
  entityId: string;
  name: string;
  category: string;
  placement: string;
  scientificName?: string | null;
  detailLines: string[];
};
