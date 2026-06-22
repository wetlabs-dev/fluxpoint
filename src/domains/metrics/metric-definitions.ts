import type { WaterParameter } from "@prisma/client";

export type CommonMetricDefinition = {
  key: string;
  displayName: string;
  description: string;
  parameter: WaterParameter | null;
  unit: string;
  prometheusName: string;
  defaultMin?: number;
  defaultMax?: number;
  displayOrder: number;
};

export const commonMetricDefinitions: CommonMetricDefinition[] = [
  {
    key: "temperature_f",
    displayName: "Temperature",
    description: "Water temperature in Fahrenheit.",
    parameter: "TEMPERATURE",
    unit: "F",
    prometheusName: "fluxpoint_aquarium_temperature_f",
    displayOrder: 10
  },
  {
    key: "ph",
    displayName: "pH",
    description: "Acidity or alkalinity reading.",
    parameter: "PH",
    unit: "pH",
    prometheusName: "fluxpoint_aquarium_ph",
    displayOrder: 20
  },
  {
    key: "salinity_ppt",
    displayName: "Salinity",
    description: "Salinity in parts per thousand.",
    parameter: "SALINITY",
    unit: "ppt",
    prometheusName: "fluxpoint_aquarium_salinity_ppt",
    displayOrder: 25
  },
  {
    key: "ammonia_ppm",
    displayName: "Ammonia",
    description: "Ammonia concentration.",
    parameter: "AMMONIA",
    unit: "ppm",
    prometheusName: "fluxpoint_aquarium_ammonia_ppm",
    displayOrder: 30
  },
  {
    key: "nitrite_ppm",
    displayName: "Nitrite",
    description: "Nitrite concentration.",
    parameter: "NITRITE",
    unit: "ppm",
    prometheusName: "fluxpoint_aquarium_nitrite_ppm",
    displayOrder: 40
  },
  {
    key: "nitrate_ppm",
    displayName: "Nitrate",
    description: "Nitrate concentration.",
    parameter: "NITRATE",
    unit: "ppm",
    prometheusName: "fluxpoint_aquarium_nitrate_ppm",
    displayOrder: 50
  },
  {
    key: "gh_dgh",
    displayName: "GH",
    description: "General hardness.",
    parameter: "GH",
    unit: "dGH",
    prometheusName: "fluxpoint_aquarium_gh_dgh",
    displayOrder: 60
  },
  {
    key: "kh_dkh",
    displayName: "KH",
    description: "Carbonate hardness.",
    parameter: "KH",
    unit: "dKH",
    prometheusName: "fluxpoint_aquarium_kh_dkh",
    displayOrder: 70
  },
  {
    key: "tds_ppm",
    displayName: "TDS",
    description: "Total dissolved solids.",
    parameter: "TDS",
    unit: "ppm",
    prometheusName: "fluxpoint_aquarium_tds_ppm",
    displayOrder: 80
  },
  {
    key: "turbidity_ntu",
    displayName: "Turbidity",
    description: "Water clarity measured in NTU.",
    parameter: "TURBIDITY",
    unit: "NTU",
    prometheusName: "fluxpoint_aquarium_turbidity_ntu",
    displayOrder: 90
  },
  {
    key: "light_par",
    displayName: "Light",
    description: "Light intensity near the aquarium.",
    parameter: "LIGHT",
    unit: "PAR",
    prometheusName: "fluxpoint_aquarium_light_par",
    displayOrder: 100
  },
  {
    key: "water_level_in",
    displayName: "Water level",
    description: "Water level from a reference point.",
    parameter: "WATER_LEVEL",
    unit: "in",
    prometheusName: "fluxpoint_aquarium_water_level_in",
    displayOrder: 110
  },
  {
    key: "co2_ppm",
    displayName: "CO2",
    description: "Dissolved carbon dioxide estimate.",
    parameter: "CO2",
    unit: "ppm",
    prometheusName: "fluxpoint_aquarium_co2_ppm",
    displayOrder: 120
  }
];
