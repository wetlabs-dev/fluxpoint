# Tank Planning and Revisions

Fluxpoint tank planning separates planned future state from current operational truth.

## Concepts

- **Aquarium** remains the real tank record. Live inventory, stocking pressure, public pages, alerts, metrics, and collection statistics read from implemented aquarium/inventory records only.
- **Aquarium plan** is a staging workspace attached to one aquarium.
  - `INITIAL_SETUP` plans are used for aquariums in `PLANNING` status.
  - `REVISION` plans are used for staged changes to active aquariums.
- **Plan items** represent intended tasks or changes such as adding livestock, attaching equipment, removing equipment, changing target water settings, or completing setup checks.

Unimplemented plan items never count as livestock, plants, equipment assignments, public contents, stocking-pressure input, metric thresholds, or operational statistics.

## Initial setup plans

When a `PLANNING` aquarium is created or first opened, Fluxpoint creates an initial setup plan. The default plan contains required setup/readiness checks for physical setup, substrate/hardscape, filtration, water targets, cycling, final verification, and activation review.

When required setup items are resolved, the plan becomes ready to complete. The aquarium is activated only when the keeper confirms **Activate aquarium** from the plan workspace.

## Revision plans

Active aquariums expose **Plan changes** from the aquarium overview quick actions. A revision plan lets the keeper stage additions, removals, replacements, target changes, and procedural work while the live tank remains unchanged.

Fluxpoint keeps completed revision plans as historical records. Physical-world changes are not rolled back automatically; corrections should be handled through normal inventory/history actions or a compensating revision.

## Applying changes

Plan item implementation is guarded and idempotent. Fluxpoint verifies the item is not already implemented, checks unresolved dependencies, then applies the supported operational change in a transaction.

Implemented support includes:

- checklist/task completion, optionally logged to the aquarium timeline
- livestock, plant, or organism additions into inventory/tank records
- equipment/substrate attachment
- equipment removal
- equipment replacement
- water target/profile/source/recipe changes with metric-threshold recalculation

Unsupported or ambiguous item types remain staged until a keeper handles them manually or a more specific implementation path is added.

## Progress and costs

Primary progress counts required items only. Cancelled items are excluded. Implemented items and skipped items with a reason count as resolved. Optional items are tracked separately.

Plan items can store estimated unit cost, estimated total, actual cost, vendor/source text, and purchase state. Costs are optional and do not affect live inventory until implementation.

## Planning views

The planning workspace shows:

- checklist grouped by category
- plan progress
- planned-state projection
- current-vs-planned summary for revisions
- cost summary

The collection-level `/planning` page summarizes planning tanks, active revisions, blocked items, and plans ready to complete.
