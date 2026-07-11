export type ManualScreenshot = {
  filename: string;
  route: string;
  selector?: string;
  caption?: string;
  viewport?: {
    width: number;
    height: number;
  };
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  waitForSelector?: string;
  state?: string;
};

export type ManualSection = {
  id: string;
  title: string;
  route?: string;
  screenshots?: ManualScreenshot[];
  screenshot?: string;
  purpose: string;
  howTo: string[];
  notes?: string[];
  warnings?: string[];
};

const defaultViewport = { width: 1280, height: 900 };
const topWorkspaceCrop = { x: 280, y: 80, width: 980, height: 760 };

function target(filename: string, route: string, selector: string, caption: string, options: Omit<ManualScreenshot, "filename" | "route" | "selector" | "caption"> = {}): ManualScreenshot {
  return { filename, route, selector, caption, viewport: defaultViewport, ...options };
}

function cropped(filename: string, route: string, caption: string, options: Omit<ManualScreenshot, "filename" | "route" | "caption"> = {}): ManualScreenshot {
  return { filename, route, caption, viewport: defaultViewport, crop: topWorkspaceCrop, ...options };
}

export const manualSections: ManualSection[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    route: "/dashboard",
    screenshots: [
      target("dashboard-summary-cards.png", "/dashboard", '[data-docs-target="dashboard-summary-cards"]', "Dashboard summary cards showing current activity, conditions, inventory, workflows, and Eddy provider status."),
      target("dashboard-aquarium-cards.png", "/dashboard", '[data-docs-target="dashboard-aquarium-cards"]', "Active aquarium cards with volume, location, inhabitants, and open condition counts.")
    ],
    purpose: "The dashboard is the morning-glance view for tanks, recent care, inventory signals, workflows, and open issues.",
    howTo: [
      "Open Dashboard from the sidebar to review current aquarium cards, active conditions, inventory counts, and upcoming work.",
      "Use aquarium cards to jump directly into a tank workspace.",
      "Use the Aquarium Intelligence dashboard panel to find tanks with stale assessments, drift concerns, or health states needing review.",
      "Check the workflow and inventory cards for reminders about templates, active runs, maintenance attention, and recently logged activity."
    ],
    notes: ["Dashboard counts are scoped to your active collection and only include records you can access."]
  },
  {
    id: "aquariums",
    title: "Aquariums",
    route: "/aquariums",
    screenshots: [
      target("aquariums-card-grid.png", "/aquariums", '[data-docs-target="aquarium-card-grid"]', "Aquarium cards focused on tank identity and at-a-glance operational stats."),
      target("aquariums-create-form.png", "/aquariums?create=1", '[data-docs-target="create-aquarium-form"]', "The create-aquarium form with identity, physical profile, classification, water targets, and attachments.")
    ],
    purpose: "Aquariums are operational tank records: identity, salinity range, volume, dimensions, target water, public settings, and workspace links.",
    howTo: [
      "Use filters to narrow by target habitat or tank type.",
      "Create a tank from the collapsed form when you need a new operational record.",
      "Attach or create a physical tank/vessel item only when you want the glass or acrylic vessel tracked as equipment inventory."
    ],
    notes: ["Aquarium volume and dimensions remain on the aquarium even when a vessel inventory item is attached."]
  },
  {
    id: "aquarium-detail",
    title: "Aquarium detail pages",
    route: "/aquariums",
    screenshots: [
      target("aquarium-detail-tabs.png", "/aquariums", '[data-docs-target="aquarium-workspace-tabs"]', "Aquarium workspace tabs for moving between overview, inhabitants, equipment, metrics, intelligence, conditions, photos, Eddy, and settings.", { state: "first-aquarium:overview" }),
      target("aquarium-detail-overview.png", "/aquariums", '[data-docs-target="aquarium-overview-core"]', "The aquarium overview workspace with tank profile details and quick actions.", { state: "first-aquarium:overview" })
    ],
    purpose: "A tank detail page is the workspace for overview, inhabitants, equipment, metrics, intelligence, conditions, timeline, schedules, photos, Eddy, and settings.",
    howTo: [
      "Open an aquarium card and use the horizontal workspace tabs to move between task areas.",
      "Use Overview for current state, Aquarium Health, water recipe calculator, stocking pressure, recent readings, and activity.",
      "Use Intelligence for deterministic health domains, parameter drift and stability, timeline insights, and assessment history.",
      "Use Settings for editable profile data, public browse controls, QR labels, and the private tank receipt."
    ],
    notes: ["Workspace tabs keep related operations close to the aquarium record instead of scattering tank actions across the app.", "Aquarium Intelligence is private by default and uses qualitative states plus separate confidence, not a public health percentage."]
  },
  {
    id: "tank-planning",
    title: "Tank Planning",
    route: "/planning",
    screenshots: [
      target("tank-planning-index.png", "/planning", "main", "The Tank Planning index with active setup plans, revisions, blockers, and ready-to-complete plans.")
    ],
    purpose: "Tank Planning stages future setup or revision work without changing live aquarium truth until individual items are implemented.",
    howTo: [
      "Create a new aquarium with status Planning to get an initial setup plan.",
      "Use Plan changes from an active aquarium overview to start a revision plan.",
      "Stage tasks, livestock, plants, equipment, water target changes, workflow links, and optional costs.",
      "Implement each item when the physical-world change is actually done, then activate the tank or complete the revision once required items are resolved."
    ],
    notes: [
      "Planned contents do not affect current inventory, public pages, stocking pressure, metrics, alerts, or collection totals.",
      "Implemented changes are physical-world history; cancelling a plan does not roll back already-applied items."
    ]
  },
  {
    id: "inhabitants",
    title: "Inhabitants",
    route: "/aquariums",
    screenshots: [
      target("aquarium-inhabitants-workspace.png", "/aquariums", '[data-docs-target="aquarium-inhabitants-workspace"]', "The inhabitants workspace showing grouped livestock and the add/loss/move controls.", { state: "first-aquarium:inhabitants" })
    ],
    purpose: "Inhabitants are inventory-backed living records grouped by fish, invertebrates, plants, corals when applicable, and other.",
    howTo: [
      "Open a tank, choose Inhabitants, and add fish, invertebrates, plants, or other living contents from the Add Inhabitant panel.",
      "Select a species or species variant when available so husbandry and stocking tools can use richer context.",
      "Use loss/removal and move controls to keep durable history instead of editing quantities silently."
    ],
    notes: ["Fluxpoint groups matching active batches when no distinct acquisition details need to be preserved."]
  },
  {
    id: "species-husbandry",
    title: "Species and husbandry",
    route: "/species",
    screenshots: [
      target("species-magic-fill-form.png", "/species?create=1", '[data-docs-target="species-form-with-magic-fill"]', "Species definition form with taxonomy, references, care metadata, regional status, aliases, and Eddy Magic Fill."),
      target("species-card-list.png", "/species", '[data-docs-target="species-card-list"]', "Saved species cards with aliases, salinity badges, variants, and husbandry links.")
    ],
    purpose: "Species definitions hold canonical aquatic metadata, aliases, variants, regional status, and husbandry guide links.",
    howTo: [
      "Create or edit species records with common name, taxonomy, salinity range, care ranges, bioload, and reference links.",
      "Use Eddy Species Magic Fill to draft metadata for review before saving.",
      "Open the husbandry workspace from a species record to review or maintain care guidance."
    ],
    warnings: ["Eddy drafts are review aids. Save only values you can support for your collection."]
  },
  {
    id: "inventory",
    title: "Inventory",
    route: "/inventory",
    screenshots: [
      target("inventory-list.png", "/inventory", '[data-docs-target="inventory-list"]', "Inventory list rows with placement, transfer controls, linked conditions, and detail links."),
      target("inventory-create-form.png", "/inventory?create=1", '[data-docs-target="inventory-create-form"]', "Create-item form for livestock, plants, equipment, supplies, and unit-price tracking.")
    ],
    purpose: "Inventory is the durable object ledger for livestock groups, plants, equipment, foods, medications, substrates, hardscape, additives, and supplies.",
    howTo: [
      "Filter records by type, placement, location, and search text.",
      "Use unit price for per-unit costs so tank receipts can calculate totals correctly.",
      "Open detail pages for movement history, QR labels, maintenance, photos, and linked conditions."
    ],
    notes: ["Aquarium inhabitants are inventory records; there is no separate livestock table."]
  },
  {
    id: "equipment",
    title: "Equipment",
    route: "/equipment",
    screenshots: [
      target("equipment-list.png", "/equipment", '[data-docs-target="equipment-list"]', "Equipment records with attachment state, maintenance status, duplication, and label actions."),
      target("equipment-create-form.png", "/equipment?create=1", '[data-docs-target="equipment-create-form"]', "Create-equipment form with identity, light capability, ownership, warranty, and maintenance fields.")
    ],
    purpose: "Equipment records track brand, model, shared capability, light output, maintenance cadence, warranty, and aquarium attachments.",
    howTo: [
      "Create equipment from the Equipment page or from an aquarium vessel flow.",
      "Attach equipment to tanks from each aquarium’s Equipment workspace.",
      "Use duplication for repeated models such as filters, heaters, or lights."
    ],
    notes: ["Physical aquarium vessels are equipment records with the Aquarium Vessel equipment type."]
  },
  {
    id: "water-sources-recipes",
    title: "Water sources and recipes",
    route: "/collection#water-sources",
    screenshots: [
      cropped("water-sources-recipes.png", "/collection#water-sources", "Collection water-source and recipe management area used for reusable tank water preparation.", { waitForSelector: "main" })
    ],
    purpose: "Structured source-water and recipe records make water preparation reusable across aquariums and visible to Eddy.",
    howTo: [
      "Open Collection and manage Water Sources for RODI, tap, well, rain, spring, mixed, or other sources.",
      "Create Water Recipes under a source and add additive doses such as buffers, remineralizers, or salts.",
      "Select a source and recipe on an aquarium profile, then use the calculator on the tank overview."
    ],
    warnings: ["Recipe calculations are advisory. Always verify mixed water with tests before use."]
  },
  {
    id: "conditions",
    title: "Conditions",
    route: "/conditions",
    screenshots: [
      target("conditions-list.png", "/conditions", '[data-docs-target="conditions-list"]', "Current condition cards with severity, status, related aquarium, observations, follow-ups, and photos."),
      target("condition-create-form.png", "/conditions?create=1", '[data-docs-target="condition-create-form"]', "Condition logging form for cross-entity health and operational issues.")
    ],
    purpose: "Conditions track health, equipment, and operational issues across aquariums, inhabitants, inventory, species, and equipment.",
    howTo: [
      "Create a condition from the Conditions page or a tank/item detail page.",
      "Link observations, severity, status, photos, and related medication courses.",
      "Resolve conditions when the issue is closed so dashboard and tank summaries stay clean."
    ],
    notes: ["Conditions are issue records, not diagnoses. Keep veterinary and regulatory decisions separate when needed."]
  },
  {
    id: "emergency-response",
    title: "Emergency response",
    route: "/emergency-response",
    screenshots: [
      cropped("emergency-response.png", "/emergency-response", "Emergency Response page showing active incidents, reusable plans, and resolved incident history.", { waitForSelector: "main" })
    ],
    purpose: "Emergency Response provides reusable playbooks and active incident workspaces for urgent aquarium events such as outages, leaks, equipment failures, oxygen crashes, contamination, and water-quality spikes.",
    howTo: [
      "Open Emergency Response to review active incidents, starter plans, and resolved incident history.",
      "Create or customize emergency plans with immediate, stabilization, recovery, and verification steps.",
      "Start an incident from a plan or from an aquarium overview, then complete checklist steps, log notes/metrics, and resolve the incident after verification."
    ],
    notes: ["Due emergency checks can appear in the Care Queue and active incidents are surfaced on the dashboard."],
    warnings: ["For water plus electricity, use only safe dry shutoffs or professional help. Eddy guidance is triage support, not veterinary certainty."]
  },
  {
    id: "breeding",
    title: "Breeding",
    route: "/breeding",
    screenshots: [
      cropped("breeding.png", "/breeding", "Breeding project dashboard with active project cards, creation flow, and cohort tracking context.", { waitForSelector: "main" })
    ],
    purpose: "Breeding projects track pairs/groups, goals, observations, cohorts, traits, milestones, photos, and graduation to inventory.",
    howTo: [
      "Create a breeding project and link parent species, variants, and aquariums.",
      "Record observations and cohort development over time.",
      "Graduate established cohorts into inventory when they become trackable stock."
    ]
  },
  {
    id: "workflows",
    title: "Workflows",
    route: "/workflows",
    screenshots: [
      cropped("workflows.png", "/workflows", "Workflow page showing reusable templates and active workflow run context.", { waitForSelector: "main" })
    ],
    purpose: "Workflows turn repeatable aquarium operations into templates and trackable runs.",
    howTo: [
      "Create or use workflow templates for recurring care processes.",
      "Start runs from the Workflows page or aquarium workspaces.",
      "Complete steps as work is performed so care history stays durable."
    ]
  },
  {
    id: "labels",
    title: "Labels / QR codes",
    route: "/labels",
    screenshots: [
      target("labels-filter-panel.png", "/labels", '[data-docs-target="label-filter-panel"]', "Label batch filters for narrowing tanks, inventory, equipment, livestock, and storage records."),
      target("labels-generation-panel.png", "/labels", '[data-docs-target="label-generation-panel"]', "Label generation panel with format selection and selected records.")
    ],
    purpose: "Labels and QR codes connect physical tanks, equipment, and inventory items back to their Fluxpoint records.",
    howTo: [
      "Open Labels to generate tank, equipment, inventory, or livestock-sheet labels.",
      "Use record detail pages to generate labels scoped to that item.",
      "Print high-contrast labels and attach them where quick scanning helps care work."
    ],
    notes: ["QR destinations remain stable even if a record is renamed."]
  },
  {
    id: "metrics",
    title: "Metrics",
    route: "/metrics",
    screenshots: [
      cropped("metrics.png", "/metrics", "Metrics workspace focused on current water-parameter status, ingestion, and dashboard sync.", { waitForSelector: "main" })
    ],
    purpose: "Metrics combine manual readings, target thresholds, ingestion tokens, and managed dashboard status.",
    howTo: [
      "Log water parameters from a tank’s Metrics workspace.",
      "Review current metric status and dashboard sync from Metrics.",
      "Use ingestion tokens for supported first-party hardware or sensor feeds."
    ],
    warnings: ["Metrics are recordkeeping and alerting aids; verify abnormal readings before corrective action."]
  },
  {
    id: "eddy",
    title: "Eddy",
    route: "/dashboard",
    screenshots: [
      target("eddy-studio.png", "/aquariums", '[data-docs-target="eddy-studio"]', "Aquarium Eddy Studio with parameter advisor and cover/summary tools.", { state: "first-aquarium:eddy" })
    ],
    purpose: "Eddy is Fluxpoint’s aquarium assistant for summaries, naming, Magic Fill, stocking pressure, parameter review, cover concepts, and care guidance.",
    howTo: [
      "Use Ask Eddy from the sidebar or contextual Eddy panels on species and aquarium pages.",
      "Review drafts before applying them to forms.",
      "Cover generation is queued; keep Eddy Studio open to watch progress, cancel a pending job, or retry a failed job.",
      "Use saved species, water recipe, equipment, and tank context to keep prompts grounded."
    ],
    warnings: ["Eddy does not replace expert care, veterinary advice, or local legal/regulatory checks."]
  },
  {
    id: "account-notifications",
    title: "Account and notifications",
    route: "/account",
    screenshots: [
      cropped("account-notifications.png", "/account", "Account settings for timezone, two-factor security, email preferences, push preferences, and devices.", { waitForSelector: "main" })
    ],
    purpose: "Account settings manage profile details, timezone, two-factor authentication, notification preferences, email preferences, and push devices.",
    howTo: [
      "Set your timezone so dates and due times display in the right local context.",
      "Open Account Security to set up authenticator-app verification codes and recovery codes.",
      "Choose email and push preferences per alert category.",
      "Enable, test, or revoke push devices from the notification settings panel."
    ],
    notes: ["Server Admin accounts must enable two-factor authentication before using server maintenance tools.", "Push notifications are optional; Fluxpoint remains usable without browser push support."]
  },
  {
    id: "collection-management",
    title: "Collection management",
    route: "/collection",
    screenshots: [
      cropped("collection-management.png", "/collection", "Collection management panels for locality, sources, locations, public settings, and water preparation records.", { waitForSelector: "main" })
    ],
    purpose: "Collection management stores locality, locations, vendors/sources, water preparation records, public browse settings, and audit links.",
    howTo: [
      "Maintain structured locations and sources so inventory and tank placement stay consistent.",
      "If you belong to multiple collections, use the collection selector in the application shell; Fluxpoint remembers the selection for your account.",
      "Set locality for regional species context.",
      "Configure public browse settings before publishing individual aquariums."
    ]
  },
  {
    id: "server-maintenance",
    title: "Server maintenance",
    route: "/server-maintenance",
    screenshots: [
      target("server-health-checks.png", "/server-maintenance", '[data-docs-target="server-health-checks"]', "Server health checks with application, database, storage, AI, email, and provider status."),
      target("server-metrics-card.png", "/server-maintenance#metrics", '[data-docs-target="server-metrics-card"]', "Server metrics card showing memory, disk, and network snapshots."),
      target("server-backups-card.png", "/server-maintenance#backups", '[data-docs-target="server-backups-card"]', "Backup management card with request, cleanup preview, and restore-planning entry points.")
    ],
    purpose: "Server Maintenance is the admin surface for health checks, metrics, storage, backups, restore planning, maintenance mode, account requests, and audit visibility.",
    howTo: [
      "Open Server Maintenance as an admin to review operational health and worker state.",
      "Open AI Jobs to inspect queue health and retry failed or dead-letter cover jobs.",
      "Use backup and restore planning tools for safe database and file operations.",
      "Enable maintenance mode when visitors should see a controlled downtime page."
    ],
    warnings: ["Server maintenance tools are admin-only and can affect the whole installation."]
  }
];

export type ManualScreenshotTarget = ManualScreenshot & {
  sectionId: string;
  sectionTitle: string;
};

export const manualScreenshotTargets: ManualScreenshotTarget[] = manualSections.flatMap((section) => {
  if (section.screenshots?.length) {
    return section.screenshots.map((screenshot) => ({
      ...screenshot,
      sectionId: section.id,
      sectionTitle: section.title
    }));
  }
  if (section.route && section.screenshot) {
    return [{
      filename: section.screenshot,
      route: section.route,
      caption: `${section.title} screenshot`,
      sectionId: section.id,
      sectionTitle: section.title
    }];
  }
  return [];
});
