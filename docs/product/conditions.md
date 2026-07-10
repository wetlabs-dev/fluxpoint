# Conditions

Fluxpoint Conditions are durable operational issue records for aquariums, inventory, livestock, plants, coral, equipment, species, and collection-wide systems. They help keepers track what was observed, what changed, and what follow-up is due. They are not veterinary diagnoses.

## Condition versus observation

A condition is the ongoing record: category, user-entered type, severity, status, affected count, summary, possible causes to investigate, and an action plan. An observation is a dated progress entry on that record. Observations can update status, severity, and affected count without erasing earlier history. Resolving a condition retains its complete history; owners archive records instead of deleting them.

The active lifecycle is `WATCHING`, `ACTIVE`, `TREATING`, `IMPROVING`, or `WORSENING`. `RESOLVED` records remain in history and can be reopened by a later observation. `ARCHIVED` records are read-only.

## Entity and aquarium links

Every condition belongs to a collection and may belong to an aquarium. It can affect an aquarium, inventory item, species definition, equipment item, plant, fish, invert, coral, system, or a custom/other subject. Generic links preserve relationships to medication courses, care tasks, timeline events, and moderated media assets.

Aquarium, Inventory, and Equipment surfaces link into Conditions. Aquarium workspaces show active records and condition-specific timeline events. The collection dashboard calls out active high and critical conditions.

## Care queue and medication

Creating or updating a condition can schedule a one-time `CONDITION_CHECK` task. Its priority is derived from condition severity. A keeper completing that task must enter an observation and may update the condition status. Medication courses can be linked as treatment context; linking may move an active condition to `TREATING`, but completing medication never resolves a condition automatically.

Medication details are stored exactly as entered from the product label. Fluxpoint does not prescribe medication.

## Photos

Condition photos use the normal aquarium media upload pipeline. Upload validation, moderation state, visibility, and hide/remove controls are unchanged. A photo does not appear as approved content until the existing moderation workflow approves it.

## Eddy

Eddy can summarize a condition record, produce an observation checklist, identify causes worth investigating, and suggest a follow-up cadence. The tool uses only recorded Fluxpoint context, consumes the normal Eddy rate limit, writes AI and audit logs, and returns a schema-constrained response. It does not diagnose or prescribe. Severe distress, rapid losses, or breathing difficulty should be escalated to an aquatic veterinarian or qualified local specialist. Never release aquarium organisms into the wild.

Aquarium Intelligence includes active condition status, severity, duration, worsening/improving state, and resolved-state boundaries in health assessments. Resolved conditions are retained as history but do not continue penalizing current health. Timeline insights may show changes that occurred before a condition, but they describe association rather than cause.

## Permissions

- Viewer: view conditions.
- Fishkeeper: add observations and complete condition care tasks.
- Aquarist: create, edit, resolve, reopen, and link conditions.
- Collection Owner: all Aquarist actions plus archive.
- Server Admin: full collection access through the standard permission helper.

## Examples

- Cyanobacteria in a display tank, with a weekly photo and water-parameter follow-up.
- Three fish showing white spots, recorded as a parasite-category observation without claiming a diagnosis.
- Filter rattling linked to an equipment record and a high-priority inspection task.
- Plant melt tracked across observations until resolved.
