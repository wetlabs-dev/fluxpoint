# Inventory detail pages

Fluxpoint gives every inventory record a first-class page at `/inventory/[id]`. Equipment records also have the focused `/equipment/[id]` route. The list pages link to these workspaces rather than requiring users to edit a row to understand it.

The workspace exposes overview, object history, conditions, treatments, photos, and QR/labels. Equipment adds maintenance and service. Quick actions reuse the existing transfer, condition, medication, loss, and maintenance records, so the history view is a read-only aggregation rather than a second event store.

History combines acquisition/creation, transfers, aquarium timeline events, condition observations, medication courses, moderated media, quarantine records, stable QR creation, and generated labels. It is collection-scoped and newest-first. Viewer access is read-only; Fishkeeper and higher roles may use care actions.

Demo examples are created only by the existing bootstrap path when `DEMO_SEED=true`. Normal bootstrap does not add sample inventory or history.
