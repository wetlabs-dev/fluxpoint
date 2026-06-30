# Tank Audits

Tank Audits are operational inventory true-up sessions for a specific aquarium. They are separate from the Fluxpoint Audit Log, which records system/security history.

## Workflow

1. Open an aquarium and choose **Start tank audit**.
2. Fluxpoint snapshots the current tank contents into audit lines.
3. Download or print the worksheet.
4. Inspect the tank and record observed quantities, sex breakdowns, health notes, plant growth notes, or equipment maintenance notes.
5. Return to the audit workspace, save the findings, review the finalize summary, and choose **Finalize audit**.

Draft audit edits do not change live inventory. Finalization is the explicit true-up step.

## What gets snapshotted

Fluxpoint snapshots existing `AquariumItem` records placed in the tank plus equipment attached through the aquarium-equipment join table. Each line preserves the expected quantity, placement, species names, equipment summary, notes, and fish sex breakdown when present.

Only one open or in-progress audit can exist for an aquarium. Starting another audit routes the user back to the active session.

## Worksheet

The worksheet is a printable PDF grouped by Fish, Invertebrates, Plants, Equipment, Hardscape/Substrate, and Other. Lines include expected quantity, blank observed quantity, confirmation/adjustment checkboxes, notes, and per-type prompts such as fish sex counts or equipment maintenance notes. Generating the worksheet does not modify inventory.

## Finalization behavior

Finalization applies accepted line actions transactionally:

- confirmed/no-change lines remain as-is, except reviewed fish sex counts can be retained;
- quantity adjustments update the existing inventory item and create aquarium timeline events;
- missing/remove lines reduce or remove the tank placement without deleting the historical item record;
- found-extra lines create new `AquariumItem` records in the aquarium;
- maintenance notes create equipment maintenance timeline records;
- condition checkboxes create basic condition records from the saved notes.

Finalization writes the aquarium timeline and the collection Audit Log. If any line cannot be applied, the audit is not finalized.

## Permissions

- Viewers can view finalized audit sessions for aquariums they can access.
- Fishkeepers can enter draft observations.
- Aquarists and Collection Owners can start and finalize audits.
- Collection Owners and Server Admins can cancel unfinalized audits.

## Limitations

Tank audits are not a rollback tool. They preserve the audit history and timeline context, but reversing a finalized true-up is done through normal inventory edits or another audit. V1 does not implement fry workflows, printer integration, or a separate livestock table.
