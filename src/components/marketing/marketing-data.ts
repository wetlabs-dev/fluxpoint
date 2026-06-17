import {
  Activity,
  Bot,
  Boxes,
  ClipboardList,
  Cpu,
  Droplets,
  GitBranch,
  Gauge,
  IdCard,
  ListChecks,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Wrench
} from "lucide-react";

export const featureCards = [
  {
    group: "Tank records",
    title: "Aquarium profiles",
    text: "Keep volume, dimensions, location, water type, substrate, lighting, filtration, heating, CO2, and target parameters in one durable tank profile.",
    Icon: Droplets
  },
  {
    group: "Tank records",
    title: "Stocking and inventory",
    text: "Track fish, inverts, plants, coral, botanicals, hardscape, foods, medications, and additives through one reusable item model.",
    Icon: Boxes
  },
  {
    group: "Operations",
    title: "Equipment tracking",
    text: "Record lights, heaters, filters, pumps, sensors, controllers, dosers, brands, models, warranties, and maintenance intervals.",
    Icon: Wrench
  },
  {
    group: "Operations",
    title: "Maintenance and husbandry logs",
    text: "Log water changes, feeding, maintenance, medication, notes, photos, stocking changes, transfers, and other timeline events.",
    Icon: ClipboardList
  },
  {
    group: "Water",
    title: "Water parameters",
    text: "Follow temperature, pH, ammonia, nitrite, nitrate, GH, KH, TDS, turbidity, light, and water level readings over time.",
    Icon: Thermometer
  },
  {
    group: "Water",
    title: "Sensor-ready metrics",
    text: "Prepare for Raspberry Pi, Pico, ESP32, and manual channels with a Prometheus-ready model that does not require live metrics on day one.",
    Icon: Gauge
  },
  {
    group: "Care rhythm",
    title: "Workflows",
    text: "Start repeatable routines for maintenance, quarantine, medication, cycling, vacations, acclimation, breeding, or custom care.",
    Icon: ListChecks
  },
  {
    group: "Identity",
    title: "AI tank naming and cover cards",
    text: "Generate tank names, palettes, motifs, dashboard cover-card concepts, and care-assistant notes from the real tank context.",
    Icon: Sparkles
  }
] as const;

export const aiNames = ["Driftlake", "Sunstream", "Springhollow", "Mossglow", "Rockmere", "Duskbrook"];

export const dashboardTanks = [
  {
    name: "Driftlake",
    mood: "quiet driftwood meadow",
    meta: "22 gal freshwater",
    gradient: "from-[#0d3e49] via-[#5f9277] to-[#d8bc79]",
    readings: ["75.8 F", "TDS 142", "Turbidity 1.1 NTU", "pH 6.8"]
  },
  {
    name: "Mossglow",
    mood: "low-tech moss garden",
    meta: "9 gal planted nano",
    gradient: "from-[#173f36] via-[#759563] to-[#e6d29a]",
    readings: ["74.9 F", "TDS 126", "Light 42%", "NO3 8 ppm"]
  },
  {
    name: "Duskbrook",
    mood: "dusky creek bend",
    meta: "29 gal blackwater",
    gradient: "from-[#172c3b] via-[#477d82] to-[#c9a96c]",
    readings: ["76.4 F", "TDS 98", "Turbidity 1.7 NTU", "pH 6.5"]
  }
] as const;

export const operationItems = [
  { title: "Transfers", text: "Move fish, plants, hardscape, and equipment between tanks or storage with one generic transfer model.", Icon: GitBranch },
  { title: "QR labels", text: "Prepare tank and equipment labels that can point back to the right record.", Icon: QrCode },
  { title: "Audit trails", text: "Keep change context for important records as the system grows into team and server operations.", Icon: ShieldCheck },
  { title: "Maintenance logs", text: "Build a living record of feeding, service, water changes, medication, and observation.", Icon: ScanLine },
  { title: "Service reminders", text: "Model equipment intervals and future reminders without bolting on a separate tool.", Icon: Activity },
  { title: "Deployment health", text: "Leave room for app, database, proxy, worker, backup, and log visibility.", Icon: Cpu }
] as const;

export const workflowSteps = [
  ["Weekly Maintenance", "Test parameters, clean glass, service filtration, trim plants, and log the care event."],
  ["New Fish Quarantine", "Track observation, acclimation, daily health checks, medication notes, and release criteria."],
  ["Medication Course", "Record diagnosis, dosage, schedule, symptoms, response, and post-course cleanup."],
  ["New Tank Cycling", "Follow ammonia, nitrite, nitrate, seed media, livestock readiness, and first stocking."],
  ["Vacation Prep", "Pre-measure feeding, check timers, top off water, verify equipment, and leave keeper notes."],
  ["Acclimation Checklist", "Float, drip, observe, net-transfer, dim lights, and log behavior after release."]
] as const;

export const hardwareItems = [
  "Raspberry Pi room bridges",
  "Pico and ESP32 sensor builds",
  "Prometheus-ready channels",
  "Grafana-friendly readings",
  "Temperature, light, TDS, turbidity, water level, and future probes"
];

export const axilLessons = [
  "collection-aware records",
  "QR labels",
  "audit trails",
  "reusable definitions",
  "image-friendly records",
  "workflow-ready architecture"
];
