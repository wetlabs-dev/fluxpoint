# Timeline Events

The aquarium timeline is the durable memory of a tank. `AquariumEvent` stores the shared event envelope: collection, aquarium, event type, title, summary, notes, date, creator, related records, and optional metadata.

## Event Scope

Every event is collection-scoped through `collectionId` and aquarium-scoped through `aquariumId`. Related item, species, schedule task, and medication course links are optional and must belong to the same collection when created by Fluxpoint actions.

## Structured Event Details

Some event types have side tables for details that should not be squeezed into freeform notes:

- `WaterChangeEvent`: gallons, percent changed, water source, conditioner, temperature matching, and structured before/after/parameter context.
- `FeedingEvent`: food inventory item or manual food snapshot, amount, optional linked inhabitant target, additional target description, and notes.
- `MaintenanceEvent`: maintenance type, optional equipment item, summary, and notes.
- `MedicationDoseEvent`: medication course, dose stage, recommended-dose snapshot, actual amount/unit, dose number, date, and notes.

The aquarium timeline filter is URL-backed (`timelineType`) so filtered views remain shareable and work without client-only state. Livestock combines additions, losses, plant movements, stocking, and deaths into one operational filter.

Water-test batches link created `WaterParameterReading` rows back to the `TEST_RESULT` event.

## Event Types

Fluxpoint keeps older event types and adds more precise new ones:

- `LIVESTOCK_ADDITION`
- `LIVESTOCK_LOSS`
- `PLANT_ADDITION`
- `PLANT_REMOVAL`
- `EQUIPMENT_MAINTENANCE`

Existing `STOCKING`, `DEATH`, `MAINTENANCE`, and other historical rows remain valid.

## UX

The aquarium workspace favors specialized quick-log forms over one giant event form. The generic event form remains available for notes, photos, observations, and unusual cases.

Aquarium Intelligence builds a normalized event stream from timeline records, water changes, conditions, workflows, losses, and other aquarium-linked changes. Saved timeline insights identify records that occurred before or near a target condition, loss, breeding observation, parameter shift, maintenance event, or equipment change. These insights are correlation prompts for review and must not be treated as proof of cause.
