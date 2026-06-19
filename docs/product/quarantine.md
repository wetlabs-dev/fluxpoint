# Quarantine

Quarantine is intentionally lightweight in this pass. A `QuarantineProject` groups inventory items under observation or isolation without creating a full treatment or husbandry system.

Projects can be active, completed, or cancelled. Each project can optionally reference a host aquarium and has reason/notes fields.

Moving an inventory item to a quarantine project:

- updates the item placement to quarantine
- creates a `QuarantineItem` entry
- records an `ItemTransfer`

Quarantine entries can be marked cleared. Clearing an entry removes the direct project placement from the item and moves it back to a storage state for follow-up transfer.

Out of scope for this pass:

- medication course automation
- quarantine protocols
- release criteria engines
- sensor or Prometheus changes
