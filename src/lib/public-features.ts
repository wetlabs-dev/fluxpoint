export type PublicFeatureStatus = "available" | "in progress" | "planned";

export type PublicFeature = {
  id: string;
  title: string;
  eyebrow: string;
  shortDescription: string;
  longDescription: string;
  highlights: string[];
  status?: PublicFeatureStatus;
  href?: string;
  icon?: string;
};

export const publicFeatures: PublicFeature[] = [
  {
    id: "aquarium-records",
    title: "Aquarium records",
    eyebrow: "Aquarium records",
    shortDescription: "Durable profiles for every tank, tub, pond, quarantine setup, and grow-out system.",
    longDescription: "Track identity, salinity range, tank type, dimensions, volume, location, public settings, target water, vessel attachment, and workspace history in one record.",
    highlights: ["Target salinity bands", "Tank/vessel inventory linkage", "Public/private controls"],
    status: "available",
    href: "/aquariums",
    icon: "fish"
  },
  {
    id: "inhabitants-stocking",
    title: "Inhabitants and stocking",
    eyebrow: "Inhabitants and stocking",
    shortDescription: "Inventory-backed fish, inverts, plants, corals, and other living contents.",
    longDescription: "Add inhabitants directly from tank pages while Fluxpoint preserves acquisition detail, movement history, loss/removal events, sex breakdowns, variants, and stocking-pressure context.",
    highlights: ["Grouped tank inhabitants", "Stocking pressure", "Loss/removal history"],
    status: "available",
    href: "/inventory"
  },
  {
    id: "species-library",
    title: "Species library",
    eyebrow: "Species library",
    shortDescription: "Canonical species definitions with aliases, variants, restrictions, and references.",
    longDescription: "Build a collection-aware species library for care ranges, bioload, salinity, regional status, scientific references, aliases, and hierarchical variants.",
    highlights: ["Aliases and variants", "Regional status context", "Reference links"],
    status: "available",
    href: "/species"
  },
  {
    id: "husbandry",
    title: "Husbandry",
    eyebrow: "Husbandry",
    shortDescription: "Care guides that stay connected to species and local aquarium context.",
    longDescription: "Maintain species-level husbandry summaries and local aquarium overrides for temperament, feeding, behavior, breeding, health, and compatibility notes.",
    highlights: ["Species guide summaries", "Local overrides", "Eddy-assisted drafts"],
    status: "available",
    href: "/species"
  },
  {
    id: "inventory",
    title: "Inventory",
    eyebrow: "Inventory",
    shortDescription: "A physical-object ledger for livestock, plants, equipment, foods, medications, additives, and supplies.",
    longDescription: "Fluxpoint treats aquarium contents as durable inventory records, so movements, costs, QR labels, photos, conditions, and history follow the object.",
    highlights: ["Unit-price receipts", "Movement history", "Photo and condition links"],
    status: "available",
    href: "/inventory"
  },
  {
    id: "equipment",
    title: "Equipment",
    eyebrow: "Equipment",
    shortDescription: "Track lights, filters, heaters, pumps, controllers, dosers, sensors, shared systems, and tank vessels.",
    longDescription: "Equipment records capture brand/model, sharing behavior, maintenance cadence, warranties, light output, and aquarium role attachments.",
    highlights: ["Shared equipment", "Maintenance cadence", "Aquarium vessel type"],
    status: "available",
    href: "/equipment"
  },
  {
    id: "metrics",
    title: "Metrics",
    eyebrow: "Metrics",
    shortDescription: "Manual readings, targets, thresholds, ingestion tokens, and dashboard readiness.",
    longDescription: "Log water readings now, prepare for sensor feeds later, and keep target thresholds synchronized with aquarium profiles.",
    highlights: ["Target thresholds", "Manual readings", "Hardware-ready ingestion"],
    status: "available",
    href: "/metrics"
  },
  {
    id: "water-sources-recipes",
    title: "Water sources and recipes",
    eyebrow: "Water sources and recipes",
    shortDescription: "Reusable source-water and mixing recipes with scalable additive dosing.",
    longDescription: "Define RODI, tap, well, rain, spring, mixed, or other sources, then build recipes that can be selected on tanks and scaled by planned mixing volume.",
    highlights: ["Source baselines", "Recipe calculator", "Inventory-linked additives"],
    status: "available",
    href: "/collection#water-sources"
  },
  {
    id: "conditions",
    title: "Conditions",
    eyebrow: "Conditions",
    shortDescription: "Cross-entity issue tracking for health, equipment, and operational concerns.",
    longDescription: "Track active and resolved conditions against tanks, inhabitants, inventory, species, and equipment with observations, severity, photos, care tasks, and medication links.",
    highlights: ["Severity and status", "Entity links", "Observation history"],
    status: "available",
    href: "/conditions"
  },
  {
    id: "breeding-projects",
    title: "Breeding projects",
    eyebrow: "Breeding projects",
    shortDescription: "Projects for parent groups, goals, observations, cohorts, traits, and graduation.",
    longDescription: "Record breeding attempts from setup through cohorts and graduate established offspring into inventory with durable origin links.",
    highlights: ["Parent and cohort tracking", "Traits and milestones", "Inventory graduation"],
    status: "available",
    href: "/breeding"
  },
  {
    id: "workflows",
    title: "Workflows",
    eyebrow: "Workflows",
    shortDescription: "Repeatable care and operations without turning the app into a checklist silo.",
    longDescription: "Template aquarium routines, start runs, complete steps, and keep workflow history attached to the right tank and collection.",
    highlights: ["Templates", "Runs", "Step history"],
    status: "available",
    href: "/workflows"
  },
  {
    id: "qr-labels",
    title: "QR labels",
    eyebrow: "QR labels",
    shortDescription: "Printable labels that connect physical aquariums and objects back to Fluxpoint.",
    longDescription: "Generate high-contrast tank, equipment, inventory, and livestock-sheet labels with stable QR destinations.",
    highlights: ["Stable QR codes", "Printable layouts", "Tank and item labels"],
    status: "available",
    href: "/labels"
  },
  {
    id: "public-browse",
    title: "Public browse",
    eyebrow: "Public browse",
    shortDescription: "Opt-in public aquarium pages with explicit section and inventory controls.",
    longDescription: "Publish selected aquarium details without exposing private operations, costs, or hidden inventory rows.",
    highlights: ["Opt-in publishing", "Public preview", "Row-level inventory selection"],
    status: "available"
  },
  {
    id: "eddy-assistant",
    title: "Eddy assistant",
    eyebrow: "Eddy assistant",
    shortDescription: "Aquarium-focused AI support for summaries, Magic Fill, stocking, parameters, and cover concepts.",
    longDescription: "Eddy uses Fluxpoint context to draft species metadata, summarize care needs, review water parameters, estimate stocking pressure, and create cover concepts for review.",
    highlights: ["Species Magic Fill", "Parameter Advisor", "Stocking pressure"],
    status: "available",
    href: "/dashboard"
  },
  {
    id: "pwa-notifications",
    title: "PWA / notifications",
    eyebrow: "PWA / notifications",
    shortDescription: "Installable app behavior plus opt-in email and push notification preferences.",
    longDescription: "Fluxpoint can run from the home screen and notify users about reminders, medication, quarantine checks, water tests, metric thresholds, server health, and Eddy digests.",
    highlights: ["Home-screen install", "Push devices", "Email and quiet-hour preferences"],
    status: "available",
    href: "/account"
  },
  {
    id: "server-maintenance",
    title: "Server maintenance",
    eyebrow: "Server maintenance",
    shortDescription: "Admin health, storage, backup, restore, and maintenance controls.",
    longDescription: "Server admins can review operational health, worker runs, delivery state, backup folders, restore plans, maintenance mode, users, collections, and audit history.",
    highlights: ["Health checks", "Backups and restore plans", "Audit visibility"],
    status: "available",
    href: "/server-maintenance"
  },
  {
    id: "reporting",
    title: "Reporting",
    eyebrow: "Reporting",
    shortDescription: "Useful summaries from labels, receipts, public pages, metrics, and breeding records.",
    longDescription: "Fluxpoint favors practical, printable and shareable records: tank receipts, livestock sheets, QR labels, public browse pages, metric charts, and breeding reports.",
    highlights: ["Tank receipts", "Livestock sheets", "Breeding summaries"],
    status: "available"
  }
];
