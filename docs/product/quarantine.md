# Quarantine

Quarantine is intentionally lightweight in this pass. A `QuarantineProject` groups inventory items under observation or isolation without creating a full treatment or husbandry system.

Projects can be active, completed, or cancelled. Each project can optionally reference a host aquarium and has reason/notes fields.

Moving an inventory item to a quarantine project:

- updates the item placement to quarantine
- creates a `QuarantineItem` entry
- records an `ItemTransfer`

When a project has a host aquarium, the Quarantine page provides an **Add all from [tank]** action. It moves eligible current host-tank inventory into the project in one transaction, skipping items already in active quarantine. By default the shortcut includes livestock and plants; keepers can opt into attached equipment/substrate when the quarantine case calls for it.

The single-item add control is context-aware. Host-tank inventory is shown first, the picker is searchable, and every item label includes quantity, type, and current placement such as aquarium, storage, shared equipment attachment, quarantine project, or unplaced.

Quarantine entries can be marked cleared. Clearing an entry removes the direct project placement from the item and moves it back to a storage state for follow-up transfer.

Out of scope for this pass:

- medication course automation
- quarantine protocols
- release criteria engines
- sensor or Prometheus changes
