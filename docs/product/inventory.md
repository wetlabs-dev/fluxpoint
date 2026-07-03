# Inventory

Fluxpoint Inventory is the central physical-object ledger. Livestock groups, plants, equipment, substrate, foods, medications, hardscape, botanicals, additives, and miscellaneous supplies remain `AquariumItem` records. There is no separate livestock table.

Inventory items can be placed in one active context at a time:

- aquarium
- storage location
- quarantine project
- unassigned

Equipment and substrate also support aquarium role attachments through `AquariumEquipmentAttachment`. For equipment, this join table is the canonical way to represent installed gear on tank pages; the old single aquarium placement is treated as ordinary inventory placement, not the attachment model. Shared equipment can appear on multiple aquarium pages when its profile is marked `Can serve multiple aquariums`.

Quantity is integer-first. Create, edit, transfer, tank-add, and loss/removal controls default to whole-number steps so browser spinners increment by 1. Existing decimal quantities remain readable, and decimal units such as ml, g, kg, oz, lb, liters, and gallons can opt into decimal steps.

Purchase price is stored and labeled as a unit price. For livestock this means price per fish, shrimp, coral frag, or other individual unit; for equipment and consumables it means price per recorded item or package. Aquarium workspaces multiply unit price by current quantity to render a private itemized receipt grouped by livestock, plants, equipment, substrate/hardscape, consumables, and other.

Duplicating equipment creates a new inventory item rather than another attachment to the same item. The duplicate copies model/profile metadata but receives a distinct QR/public code and does not inherit serial numbers, photos, maintenance history, active conditions, or current aquarium attachments.

Fish inventory can carry an approximate sex breakdown on the same `AquariumItem`: optional male and female counts plus a derived unsexed count (`quantity - male - female`). The controls are shown only for fish records and validate that counts are non-negative whole numbers that do not exceed the total quantity. Inventory detail and aquarium inhabitants display compact labels such as `2 male · 3 female · 1 unsexed`.

Species linking is conditional. Fish, invertebrate, and plant inventory show a species selector; equipment, substrate, hardscape, food, medication, additive, botanical, and generic other records hide it by default. When an aquarium is selected, the species picker is filtered by both item type and the aquarium target salinity range.

If a species is selected while the item name is blank or still auto-filled, the item name inherits the species common name, then scientific name, then genus/species display. Once the user edits the name manually, Fluxpoint treats it as a custom display name and stops overwriting it.

Tank inhabitants are inventory records. Adding fish, invertebrates, plants, or coral/other directly from an aquarium page silently creates or updates the underlying `AquariumItem`, writes a timeline event, and audits the action. If an active matching tank group already exists for the same species and item type, and no distinct acquisition/source metadata is supplied, Fluxpoint increments the existing group. Otherwise it creates a separate item record to preserve the acquisition distinction.

Tank Audits provide a structured true-up path for aquarium inventory. Audit sessions snapshot current tank contents, let keepers enter observed quantities and notes without changing live records, then update `AquariumItem` quantities, placement, found-extra items, timeline events, and audit history only when the audit is finalized.

Full transfers carry a fish sex breakdown with the inventory group. Partial transfers intentionally clear the new partial item's sex breakdown for v1, because Fluxpoint cannot know which exact fish moved. The source group keeps its breakdown only if it remains mathematically possible after the quantity change; otherwise the counts are cleared so the keeper can update them explicitly. Loss/removal follows the same safety rule.

Restricted or concerning regional species rules are still enforced when creating inventory, moving inventory into a tank, or adding inhabitants directly from a tank.

## Additional tank contents are not Inventory

`AquariumAdditionalContent` rows are a parking lot for things Fluxpoint should remember before they become durable physical-object records. They do not replace `AquariumItem`, do not participate in QR labels, receipts, transfers, losses, sex breakdowns, quarantine placement, public inventory rows, or species restriction enforcement.

When a remembered content row is marked **Needs structured record**, the aquarium UI surfaces it as follow-up work. v1 keeps conversion as a planned/manual action so that keepers still choose the correct inventory type, species/variant, source, quantity, unit price, and placement deliberately.
