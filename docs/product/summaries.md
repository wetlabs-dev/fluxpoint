# Concise Tank Summaries

Fluxpoint can generate deterministic concise tank summaries for one aquarium or for every aquarium in the active collection. These are compact, copyable snapshots intended for care handoffs, forum posts, text messages, printed worksheets, and Eddy prompts.

Summaries are generated from saved records rather than scraped UI. The single-tank summary is available from the aquarium Overview quick actions and renders in-page with:

- Compact, Standard, and Detailed modes
- Plain text and Markdown formats
- Copy-to-clipboard
- `.txt` / `.md` download
- Refresh

Collection-wide summaries are available from **Collection → Summarize all tanks** at `/collection/tank-summaries`.

## Included data

Single-tank summaries include:

- Aquarium name, status, salinity, type, volume, location, dimensions, and estimated volume when available
- Water targets, water source, and water recipe
- Grouped inhabitants using the same species/variant grouping as the tank page
- Equipment grouped by aquarium role, including vessel, filters, heaters, lights, CO₂, aeration, controllers, pumps, monitors, and other equipment
- Lighting schedule names, equivalent full-output hours, and lumen-hours when fixture output is available
- Open conditions, active emergency incidents, active workflows, and upcoming care tasks
- Additional tank contents that are marked for Eddy context, labeled as unstructured notes
- Missing or uncertain fields such as missing volume, pH target, water source, or equipment

Detailed mode includes batch counts where repeated species/variant batches were collapsed.

## Collection summaries

Collection summaries include top-level collection totals:

- tank count
- total recorded gallons
- total fish
- total plants
- total open conditions

Each tank appears once. Compact mode keeps each tank to a tight paragraph; Standard and Detailed modes include more of the single-tank profile.

## Privacy and limits

These summaries are authenticated owner-facing exports. They do not include raw internal IDs, prices, user emails, audit logs, server data, or public-share URLs. Public Browse does not expose concise summaries automatically.

The current version is deterministic. Eddy-polished wording can be added later, but the saved-record summary remains the source of truth and works without AI.
