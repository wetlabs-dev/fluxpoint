# Inventory Transfers

Inventory movement is modeled through `ItemTransfer`. Transfers can move part or all of an item between:

- an aquarium
- a storage location
- a quarantine project
- a terminal state such as consumed, removed, or dead

Partial transfers split the inventory record. The original item quantity is reduced and the moved quantity becomes a new destination item. Full transfers update the existing item placement.

Storage locations reuse the collection `Location` model with storage-oriented location types such as bin, drawer, refrigerator, freezer, cabinet, and shelf.

Transfer history keeps the source and destination context:

- source aquarium, storage location, or quarantine project
- destination aquarium, storage location, or quarantine project
- moved quantity
- reason and notes
- destination item for split transfers

Aquarium moves create timeline transfer events for affected tanks.
