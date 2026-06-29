# Inventory

Fluxpoint Inventory is the central physical-object ledger. Livestock groups, plants, equipment, substrate, foods, medications, hardscape, botanicals, additives, and miscellaneous supplies remain `AquariumItem` records. There is no separate livestock table.

Inventory items can be placed in one active context at a time:

- aquarium
- storage location
- quarantine project
- unassigned

Quantity is integer-first. Create, edit, transfer, tank-add, and loss/removal controls default to whole-number steps so browser spinners increment by 1. Existing decimal quantities remain readable, and decimal units such as ml, g, kg, oz, lb, liters, and gallons can opt into decimal steps.

Species linking is conditional. Fish, invertebrate, and plant inventory show a species selector; equipment, substrate, hardscape, food, medication, additive, botanical, and generic other records hide it by default. When an aquarium is selected, the species picker is filtered by both item type and the aquarium target salinity range.

If a species is selected while the item name is blank or still auto-filled, the item name inherits the species common name, then scientific name, then genus/species display. Once the user edits the name manually, Fluxpoint treats it as a custom display name and stops overwriting it.

Tank inhabitants are inventory records. Adding fish, invertebrates, plants, or coral/other directly from an aquarium page silently creates or updates the underlying `AquariumItem`, writes a timeline event, and audits the action. If an active matching tank group already exists for the same species and item type, and no distinct acquisition/source metadata is supplied, Fluxpoint increments the existing group. Otherwise it creates a separate item record to preserve the acquisition distinction.

Restricted or concerning regional species rules are still enforced when creating inventory, moving inventory into a tank, or adding inhabitants directly from a tank.
