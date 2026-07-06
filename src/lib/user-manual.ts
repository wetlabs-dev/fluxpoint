export type ManualSection = {
  id: string;
  title: string;
  route?: string;
  screenshot?: string;
  purpose: string;
  howTo: string[];
  notes?: string[];
  warnings?: string[];
};

export const manualSections: ManualSection[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    route: "/dashboard",
    screenshot: "dashboard.png",
    purpose: "The dashboard is the morning-glance view for tanks, recent care, inventory signals, workflows, and open issues.",
    howTo: [
      "Open Dashboard from the sidebar to review current aquarium cards, active conditions, inventory counts, and upcoming work.",
      "Use aquarium cards to jump directly into a tank workspace.",
      "Check the workflow and inventory cards for reminders about templates, active runs, maintenance attention, and recently logged activity."
    ],
    notes: ["Dashboard counts are scoped to your active collection and only include records you can access."]
  },
  {
    id: "aquariums",
    title: "Aquariums",
    route: "/aquariums",
    screenshot: "aquariums.png",
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
    screenshot: "aquarium-detail.png",
    purpose: "A tank detail page is the workspace for overview, inhabitants, equipment, metrics, conditions, timeline, schedules, photos, Eddy, and settings.",
    howTo: [
      "Open an aquarium card and use the horizontal workspace tabs to move between task areas.",
      "Use Overview for current state, water recipe calculator, stocking pressure, recent readings, and activity.",
      "Use Settings for editable profile data, public browse controls, QR labels, and the private tank receipt."
    ],
    notes: ["Workspace tabs keep related operations close to the aquarium record instead of scattering tank actions across the app."]
  },
  {
    id: "inhabitants",
    title: "Inhabitants",
    route: "/aquariums",
    screenshot: "inhabitants.png",
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
    screenshot: "species.png",
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
    screenshot: "inventory.png",
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
    screenshot: "equipment.png",
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
    screenshot: "water-sources-recipes.png",
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
    screenshot: "conditions.png",
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
    screenshot: "emergency-response.png",
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
    screenshot: "breeding.png",
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
    screenshot: "workflows.png",
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
    screenshot: "labels.png",
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
    screenshot: "metrics.png",
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
    screenshot: "eddy.png",
    purpose: "Eddy is Fluxpoint’s aquarium assistant for summaries, naming, Magic Fill, stocking pressure, parameter review, cover concepts, and care guidance.",
    howTo: [
      "Use Ask Eddy from the sidebar or contextual Eddy panels on species and aquarium pages.",
      "Review drafts before applying them to forms.",
      "Use saved species, water recipe, equipment, and tank context to keep prompts grounded."
    ],
    warnings: ["Eddy does not replace expert care, veterinary advice, or local legal/regulatory checks."]
  },
  {
    id: "account-notifications",
    title: "Account and notifications",
    route: "/account",
    screenshot: "account.png",
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
    screenshot: "collection.png",
    purpose: "Collection management stores locality, locations, vendors/sources, water preparation records, public browse settings, and audit links.",
    howTo: [
      "Maintain structured locations and sources so inventory and tank placement stay consistent.",
      "Set locality for regional species context.",
      "Configure public browse settings before publishing individual aquariums."
    ]
  },
  {
    id: "server-maintenance",
    title: "Server maintenance",
    route: "/server-maintenance",
    screenshot: "server-maintenance.png",
    purpose: "Server Maintenance is the admin surface for health checks, metrics, storage, backups, restore planning, maintenance mode, account requests, and audit visibility.",
    howTo: [
      "Open Server Maintenance as an admin to review operational health and worker state.",
      "Use backup and restore planning tools for safe database and file operations.",
      "Enable maintenance mode when visitors should see a controlled downtime page."
    ],
    warnings: ["Server maintenance tools are admin-only and can affect the whole installation."]
  }
];

export const manualScreenshotTargets = manualSections.filter((section) => section.route && section.screenshot);
