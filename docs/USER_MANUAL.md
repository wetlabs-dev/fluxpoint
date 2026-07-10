# Fluxpoint User Manual

Generated from `src/lib/user-manual.ts`. Edit the typed source and run `npm run docs:manual` to refresh this file.

## Contents

- [Dashboard](#dashboard) — `/dashboard`
- [Aquariums](#aquariums) — `/aquariums`
- [Aquarium detail pages](#aquarium-detail) — `/aquariums`
- [Tank Planning](#tank-planning) — `/planning`
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

### Screenshots

![Dashboard summary cards showing current activity, conditions, inventory, workflows, and Eddy provider status.](/manual/screenshots/dashboard-summary-cards.png)

_Dashboard summary cards showing current activity, conditions, inventory, workflows, and Eddy provider status._

Route/context: `/dashboard`

![Active aquarium cards with volume, location, inhabitants, and open condition counts.](/manual/screenshots/dashboard-aquarium-cards.png)

_Active aquarium cards with volume, location, inhabitants, and open condition counts._

Route/context: `/dashboard`

### Purpose

The dashboard is the morning-glance view for tanks, recent care, inventory signals, workflows, and open issues.

### How to

- Open Dashboard from the sidebar to review current aquarium cards, active conditions, inventory counts, and upcoming work.
- Use aquarium cards to jump directly into a tank workspace.
- Use the Aquarium Intelligence dashboard panel to find tanks with stale assessments, drift concerns, or health states needing review.
- Check the workflow and inventory cards for reminders about templates, active runs, maintenance attention, and recently logged activity.

### Notes

- Dashboard counts are scoped to your active collection and only include records you can access.

## Aquariums

Route: `/aquariums`

### Screenshots

![Aquarium cards focused on tank identity and at-a-glance operational stats.](/manual/screenshots/aquariums-card-grid.png)

_Aquarium cards focused on tank identity and at-a-glance operational stats._

Route/context: `/aquariums`

![The create-aquarium form with identity, physical profile, classification, water targets, and attachments.](/manual/screenshots/aquariums-create-form.png)

_The create-aquarium form with identity, physical profile, classification, water targets, and attachments._

Route/context: `/aquariums?create=1`

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

### Screenshots

![Aquarium workspace tabs for moving between overview, inhabitants, equipment, metrics, intelligence, conditions, photos, Eddy, and settings.](/manual/screenshots/aquarium-detail-tabs.png)

_Aquarium workspace tabs for moving between overview, inhabitants, equipment, metrics, intelligence, conditions, photos, Eddy, and settings._

Route/context: `/aquariums`

![The aquarium overview workspace with tank profile details and quick actions.](/manual/screenshots/aquarium-detail-overview.png)

_The aquarium overview workspace with tank profile details and quick actions._

Route/context: `/aquariums`

### Purpose

A tank detail page is the workspace for overview, inhabitants, equipment, metrics, intelligence, conditions, timeline, schedules, photos, Eddy, and settings.

### How to

- Open an aquarium card and use the horizontal workspace tabs to move between task areas.
- Use Overview for current state, Aquarium Health, water recipe calculator, stocking pressure, recent readings, and activity.
- Use Intelligence for deterministic health domains, parameter drift and stability, timeline insights, and assessment history.
- Use Settings for editable profile data, public browse controls, QR labels, and the private tank receipt.

### Notes

- Workspace tabs keep related operations close to the aquarium record instead of scattering tank actions across the app.
- Aquarium Intelligence is private by default and uses qualitative states plus separate confidence, not a public health percentage.

## Tank Planning

Route: `/planning`

### Screenshots

![The Tank Planning index with active setup plans, revisions, blockers, and ready-to-complete plans.](/manual/screenshots/tank-planning-index.png)

_The Tank Planning index with active setup plans, revisions, blockers, and ready-to-complete plans._

Route/context: `/planning`

### Purpose

Tank Planning stages future setup or revision work without changing live aquarium truth until individual items are implemented.

### How to

- Create a new aquarium with status Planning to get an initial setup plan.
- Use Plan changes from an active aquarium overview to start a revision plan.
- Stage tasks, livestock, plants, equipment, water target changes, workflow links, and optional costs.
- Implement each item when the physical-world change is actually done, then activate the tank or complete the revision once required items are resolved.

### Notes

- Planned contents do not affect current inventory, public pages, stocking pressure, metrics, alerts, or collection totals.
- Implemented changes are physical-world history; cancelling a plan does not roll back already-applied items.

## Inhabitants

Route: `/aquariums`

### Screenshots

![The inhabitants workspace showing grouped livestock and the add/loss/move controls.](/manual/screenshots/aquarium-inhabitants-workspace.png)

_The inhabitants workspace showing grouped livestock and the add/loss/move controls._

Route/context: `/aquariums`

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

### Screenshots

![Species definition form with taxonomy, references, care metadata, regional status, aliases, and Eddy Magic Fill.](/manual/screenshots/species-magic-fill-form.png)

_Species definition form with taxonomy, references, care metadata, regional status, aliases, and Eddy Magic Fill._

Route/context: `/species?create=1`

![Saved species cards with aliases, salinity badges, variants, and husbandry links.](/manual/screenshots/species-card-list.png)

_Saved species cards with aliases, salinity badges, variants, and husbandry links._

Route/context: `/species`

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

### Screenshots

![Inventory list rows with placement, transfer controls, linked conditions, and detail links.](/manual/screenshots/inventory-list.png)

_Inventory list rows with placement, transfer controls, linked conditions, and detail links._

Route/context: `/inventory`

![Create-item form for livestock, plants, equipment, supplies, and unit-price tracking.](/manual/screenshots/inventory-create-form.png)

_Create-item form for livestock, plants, equipment, supplies, and unit-price tracking._

Route/context: `/inventory?create=1`

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

### Screenshots

![Equipment records with attachment state, maintenance status, duplication, and label actions.](/manual/screenshots/equipment-list.png)

_Equipment records with attachment state, maintenance status, duplication, and label actions._

Route/context: `/equipment`

![Create-equipment form with identity, light capability, ownership, warranty, and maintenance fields.](/manual/screenshots/equipment-create-form.png)

_Create-equipment form with identity, light capability, ownership, warranty, and maintenance fields._

Route/context: `/equipment?create=1`

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

### Screenshots

![Collection water-source and recipe management area used for reusable tank water preparation.](/manual/screenshots/water-sources-recipes.png)

_Collection water-source and recipe management area used for reusable tank water preparation._

Route/context: `/collection#water-sources`

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

### Screenshots

![Current condition cards with severity, status, related aquarium, observations, follow-ups, and photos.](/manual/screenshots/conditions-list.png)

_Current condition cards with severity, status, related aquarium, observations, follow-ups, and photos._

Route/context: `/conditions`

![Condition logging form for cross-entity health and operational issues.](/manual/screenshots/condition-create-form.png)

_Condition logging form for cross-entity health and operational issues._

Route/context: `/conditions?create=1`

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

### Screenshots

![Emergency Response page showing active incidents, reusable plans, and resolved incident history.](/manual/screenshots/emergency-response.png)

_Emergency Response page showing active incidents, reusable plans, and resolved incident history._

Route/context: `/emergency-response`

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

### Screenshots

![Breeding project dashboard with active project cards, creation flow, and cohort tracking context.](/manual/screenshots/breeding.png)

_Breeding project dashboard with active project cards, creation flow, and cohort tracking context._

Route/context: `/breeding`

### Purpose

Breeding projects track pairs/groups, goals, observations, cohorts, traits, milestones, photos, and graduation to inventory.

### How to

- Create a breeding project and link parent species, variants, and aquariums.
- Record observations and cohort development over time.
- Graduate established cohorts into inventory when they become trackable stock.

## Workflows

Route: `/workflows`

### Screenshots

![Workflow page showing reusable templates and active workflow run context.](/manual/screenshots/workflows.png)

_Workflow page showing reusable templates and active workflow run context._

Route/context: `/workflows`

### Purpose

Workflows turn repeatable aquarium operations into templates and trackable runs.

### How to

- Create or use workflow templates for recurring care processes.
- Start runs from the Workflows page or aquarium workspaces.
- Complete steps as work is performed so care history stays durable.

## Labels / QR codes

Route: `/labels`

### Screenshots

![Label batch filters for narrowing tanks, inventory, equipment, livestock, and storage records.](/manual/screenshots/labels-filter-panel.png)

_Label batch filters for narrowing tanks, inventory, equipment, livestock, and storage records._

Route/context: `/labels`

![Label generation panel with format selection and selected records.](/manual/screenshots/labels-generation-panel.png)

_Label generation panel with format selection and selected records._

Route/context: `/labels`

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

### Screenshots

![Metrics workspace focused on current water-parameter status, ingestion, and dashboard sync.](/manual/screenshots/metrics.png)

_Metrics workspace focused on current water-parameter status, ingestion, and dashboard sync._

Route/context: `/metrics`

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

### Screenshots

![Aquarium Eddy Studio with parameter advisor and cover/summary tools.](/manual/screenshots/eddy-studio.png)

_Aquarium Eddy Studio with parameter advisor and cover/summary tools._

Route/context: `/aquariums`

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

### Screenshots

![Account settings for timezone, two-factor security, email preferences, push preferences, and devices.](/manual/screenshots/account-notifications.png)

_Account settings for timezone, two-factor security, email preferences, push preferences, and devices._

Route/context: `/account`

### Purpose

Account settings manage profile details, timezone, two-factor authentication, notification preferences, email preferences, and push devices.

### How to

- Set your timezone so dates and due times display in the right local context.
- Open Account Security to set up authenticator-app verification codes and recovery codes.
- Choose email and push preferences per alert category.
- Enable, test, or revoke push devices from the notification settings panel.

### Notes

- Server Admin accounts must enable two-factor authentication before using server maintenance tools.
- Push notifications are optional; Fluxpoint remains usable without browser push support.

## Collection management

Route: `/collection`

### Screenshots

![Collection management panels for locality, sources, locations, public settings, and water preparation records.](/manual/screenshots/collection-management.png)

_Collection management panels for locality, sources, locations, public settings, and water preparation records._

Route/context: `/collection`

### Purpose

Collection management stores locality, locations, vendors/sources, water preparation records, public browse settings, and audit links.

### How to

- Maintain structured locations and sources so inventory and tank placement stay consistent.
- Set locality for regional species context.
- Configure public browse settings before publishing individual aquariums.

## Server maintenance

Route: `/server-maintenance`

### Screenshots

![Server health checks with application, database, storage, AI, email, and provider status.](/manual/screenshots/server-health-checks.png)

_Server health checks with application, database, storage, AI, email, and provider status._

Route/context: `/server-maintenance`

![Server metrics card showing memory, disk, and network snapshots.](/manual/screenshots/server-metrics-card.png)

_Server metrics card showing memory, disk, and network snapshots._

Route/context: `/server-maintenance#metrics`

![Backup management card with request, cleanup preview, and restore-planning entry points.](/manual/screenshots/server-backups-card.png)

_Backup management card with request, cleanup preview, and restore-planning entry points._

Route/context: `/server-maintenance#backups`

### Purpose

Server Maintenance is the admin surface for health checks, metrics, storage, backups, restore planning, maintenance mode, account requests, and audit visibility.

### How to

- Open Server Maintenance as an admin to review operational health and worker state.
- Use backup and restore planning tools for safe database and file operations.
- Enable maintenance mode when visitors should see a controlled downtime page.

### Warnings

- Server maintenance tools are admin-only and can affect the whole installation.
