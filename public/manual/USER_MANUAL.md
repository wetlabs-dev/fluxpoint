# Fluxpoint User Manual

Generated from `src/lib/user-manual.ts`. Edit the typed source and run `npm run docs:manual` to refresh this file.

## Contents

- [Dashboard](#dashboard) — `/dashboard`
- [Aquariums](#aquariums) — `/aquariums`
- [Aquarium detail pages](#aquarium-detail) — `/aquariums`
- [Inhabitants](#inhabitants) — `/aquariums`
- [Species and husbandry](#species-husbandry) — `/species`
- [Inventory](#inventory) — `/inventory`
- [Equipment](#equipment) — `/equipment`
- [Water sources and recipes](#water-sources-recipes) — `/collection#water-sources`
- [Conditions](#conditions) — `/conditions`
- [Emergency response](#emergency-response) — `/emergency-response`
- [Breeding](#breeding) — `/breeding`
- [Workflows](#workflows) — `/workflows`
- [Labels / QR codes](#labels) — `/labels`
- [Metrics](#metrics) — `/metrics`
- [Eddy](#eddy) — `/dashboard`
- [Account and notifications](#account-notifications) — `/account`
- [Collection management](#collection-management) — `/collection`
- [Server maintenance](#server-maintenance) — `/server-maintenance`

## Dashboard

Route: `/dashboard`

Screenshot: `/manual/screenshots/dashboard.png`

### Purpose

The dashboard is the morning-glance view for tanks, recent care, inventory signals, workflows, and open issues.

### How to

- Open Dashboard from the sidebar to review current aquarium cards, active conditions, inventory counts, and upcoming work.
- Use aquarium cards to jump directly into a tank workspace.
- Check the workflow and inventory cards for reminders about templates, active runs, maintenance attention, and recently logged activity.

### Notes

- Dashboard counts are scoped to your active collection and only include records you can access.

## Aquariums

Route: `/aquariums`

Screenshot: `/manual/screenshots/aquariums.png`

### Purpose

Aquariums are operational tank records: identity, salinity range, volume, dimensions, target water, public settings, and workspace links.

### How to

- Use filters to narrow by target habitat or tank type.
- Create a tank from the collapsed form when you need a new operational record.
- Attach or create a physical tank/vessel item only when you want the glass or acrylic vessel tracked as equipment inventory.

### Notes

- Aquarium volume and dimensions remain on the aquarium even when a vessel inventory item is attached.

## Aquarium detail pages

Route: `/aquariums`

Screenshot: `/manual/screenshots/aquarium-detail.png`

### Purpose

A tank detail page is the workspace for overview, inhabitants, equipment, metrics, conditions, timeline, schedules, photos, Eddy, and settings.

### How to

- Open an aquarium card and use the horizontal workspace tabs to move between task areas.
- Use Overview for current state, water recipe calculator, stocking pressure, recent readings, and activity.
- Use Settings for editable profile data, public browse controls, QR labels, and the private tank receipt.

### Notes

- Workspace tabs keep related operations close to the aquarium record instead of scattering tank actions across the app.

## Inhabitants

Route: `/aquariums`

Screenshot: `/manual/screenshots/inhabitants.png`

### Purpose

Inhabitants are inventory-backed living records grouped by fish, invertebrates, plants, corals when applicable, and other.

### How to

- Open a tank, choose Inhabitants, and add fish, invertebrates, plants, or other living contents from the Add Inhabitant panel.
- Select a species or species variant when available so husbandry and stocking tools can use richer context.
- Use loss/removal and move controls to keep durable history instead of editing quantities silently.

### Notes

- Fluxpoint groups matching active batches when no distinct acquisition details need to be preserved.

## Species and husbandry

Route: `/species`

Screenshot: `/manual/screenshots/species.png`

### Purpose

Species definitions hold canonical aquatic metadata, aliases, variants, regional status, and husbandry guide links.

### How to

- Create or edit species records with common name, taxonomy, salinity range, care ranges, bioload, and reference links.
- Use Eddy Species Magic Fill to draft metadata for review before saving.
- Open the husbandry workspace from a species record to review or maintain care guidance.

### Warnings

- Eddy drafts are review aids. Save only values you can support for your collection.

## Inventory

Route: `/inventory`

Screenshot: `/manual/screenshots/inventory.png`

### Purpose

Inventory is the durable object ledger for livestock groups, plants, equipment, foods, medications, substrates, hardscape, additives, and supplies.

### How to

- Filter records by type, placement, location, and search text.
- Use unit price for per-unit costs so tank receipts can calculate totals correctly.
- Open detail pages for movement history, QR labels, maintenance, photos, and linked conditions.

### Notes

- Aquarium inhabitants are inventory records; there is no separate livestock table.

## Equipment

Route: `/equipment`

Screenshot: `/manual/screenshots/equipment.png`

### Purpose

Equipment records track brand, model, shared capability, light output, maintenance cadence, warranty, and aquarium attachments.

### How to

- Create equipment from the Equipment page or from an aquarium vessel flow.
- Attach equipment to tanks from each aquarium’s Equipment workspace.
- Use duplication for repeated models such as filters, heaters, or lights.

### Notes

- Physical aquarium vessels are equipment records with the Aquarium Vessel equipment type.

## Water sources and recipes

Route: `/collection#water-sources`

Screenshot: `/manual/screenshots/water-sources-recipes.png`

### Purpose

Structured source-water and recipe records make water preparation reusable across aquariums and visible to Eddy.

### How to

- Open Collection and manage Water Sources for RODI, tap, well, rain, spring, mixed, or other sources.
- Create Water Recipes under a source and add additive doses such as buffers, remineralizers, or salts.
- Select a source and recipe on an aquarium profile, then use the calculator on the tank overview.

### Warnings

- Recipe calculations are advisory. Always verify mixed water with tests before use.

## Conditions

Route: `/conditions`

Screenshot: `/manual/screenshots/conditions.png`

### Purpose

Conditions track health, equipment, and operational issues across aquariums, inhabitants, inventory, species, and equipment.

### How to

- Create a condition from the Conditions page or a tank/item detail page.
- Link observations, severity, status, photos, and related medication courses.
- Resolve conditions when the issue is closed so dashboard and tank summaries stay clean.

### Notes

- Conditions are issue records, not diagnoses. Keep veterinary and regulatory decisions separate when needed.

## Emergency response

Route: `/emergency-response`

Screenshot: `/manual/screenshots/emergency-response.png`

### Purpose

Emergency Response provides reusable playbooks and active incident workspaces for urgent aquarium events such as outages, leaks, equipment failures, oxygen crashes, contamination, and water-quality spikes.

### How to

- Open Emergency Response to review active incidents, starter plans, and resolved incident history.
- Create or customize emergency plans with immediate, stabilization, recovery, and verification steps.
- Start an incident from a plan or from an aquarium overview, then complete checklist steps, log notes/metrics, and resolve the incident after verification.

### Notes

- Due emergency checks can appear in the Care Queue and active incidents are surfaced on the dashboard.

### Warnings

- For water plus electricity, use only safe dry shutoffs or professional help. Eddy guidance is triage support, not veterinary certainty.

## Breeding

Route: `/breeding`

Screenshot: `/manual/screenshots/breeding.png`

### Purpose

Breeding projects track pairs/groups, goals, observations, cohorts, traits, milestones, photos, and graduation to inventory.

### How to

- Create a breeding project and link parent species, variants, and aquariums.
- Record observations and cohort development over time.
- Graduate established cohorts into inventory when they become trackable stock.

## Workflows

Route: `/workflows`

Screenshot: `/manual/screenshots/workflows.png`

### Purpose

Workflows turn repeatable aquarium operations into templates and trackable runs.

### How to

- Create or use workflow templates for recurring care processes.
- Start runs from the Workflows page or aquarium workspaces.
- Complete steps as work is performed so care history stays durable.

## Labels / QR codes

Route: `/labels`

Screenshot: `/manual/screenshots/labels.png`

### Purpose

Labels and QR codes connect physical tanks, equipment, and inventory items back to their Fluxpoint records.

### How to

- Open Labels to generate tank, equipment, inventory, or livestock-sheet labels.
- Use record detail pages to generate labels scoped to that item.
- Print high-contrast labels and attach them where quick scanning helps care work.

### Notes

- QR destinations remain stable even if a record is renamed.

## Metrics

Route: `/metrics`

Screenshot: `/manual/screenshots/metrics.png`

### Purpose

Metrics combine manual readings, target thresholds, ingestion tokens, and managed dashboard status.

### How to

- Log water parameters from a tank’s Metrics workspace.
- Review current metric status and dashboard sync from Metrics.
- Use ingestion tokens for supported first-party hardware or sensor feeds.

### Warnings

- Metrics are recordkeeping and alerting aids; verify abnormal readings before corrective action.

## Eddy

Route: `/dashboard`

Screenshot: `/manual/screenshots/eddy.png`

### Purpose

Eddy is Fluxpoint’s aquarium assistant for summaries, naming, Magic Fill, stocking pressure, parameter review, cover concepts, and care guidance.

### How to

- Use Ask Eddy from the sidebar or contextual Eddy panels on species and aquarium pages.
- Review drafts before applying them to forms.
- Use saved species, water recipe, equipment, and tank context to keep prompts grounded.

### Warnings

- Eddy does not replace expert care, veterinary advice, or local legal/regulatory checks.

## Account and notifications

Route: `/account`

Screenshot: `/manual/screenshots/account.png`

### Purpose

Account settings manage profile details, timezone, notification preferences, email preferences, and push devices.

### How to

- Set your timezone so dates and due times display in the right local context.
- Choose email and push preferences per alert category.
- Enable, test, or revoke push devices from the notification settings panel.

### Notes

- Push notifications are optional; Fluxpoint remains usable without browser push support.

## Collection management

Route: `/collection`

Screenshot: `/manual/screenshots/collection.png`

### Purpose

Collection management stores locality, locations, vendors/sources, water preparation records, public browse settings, and audit links.

### How to

- Maintain structured locations and sources so inventory and tank placement stay consistent.
- Set locality for regional species context.
- Configure public browse settings before publishing individual aquariums.

## Server maintenance

Route: `/server-maintenance`

Screenshot: `/manual/screenshots/server-maintenance.png`

### Purpose

Server Maintenance is the admin surface for health checks, metrics, storage, backups, restore planning, maintenance mode, account requests, and audit visibility.

### How to

- Open Server Maintenance as an admin to review operational health and worker state.
- Use backup and restore planning tools for safe database and file operations.
- Enable maintenance mode when visitors should see a controlled downtime page.

### Warnings

- Server maintenance tools are admin-only and can affect the whole installation.
