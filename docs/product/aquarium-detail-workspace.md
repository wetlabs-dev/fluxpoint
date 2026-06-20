# Aquarium Detail Workspace

`/aquariums/[id]` is Fluxpoint's primary tank workspace. It is organized around aquarium operations rather than database tables.

## Tabs

- Overview: approved cover photo or generated identity, tank status, volume estimate, location, age, selected equipment, latest readings, recent events, tasks, and latest approved photos.
- Inhabitants: fish, invertebrates, plants, and coral/other living records from `AquariumItem` and optional `SpeciesDefinition` links.
- Equipment: assigned tank equipment, lighting assignment, and equipment/tank maintenance logging.
- Metrics: manual water-test batch entry, latest readings, Prometheus metric names, thresholds, ingestion tokens, and managed graph panel status.
- Timeline: durable event history with structured event detail cards and approved photo attachments.
- Schedules: feeding, active medications, pending care tasks, and care history.
- Photos: a collection-scoped gallery of aquarium, timeline, inhabitant, and equipment photos with moderation state, cover, hide, and remove controls.
- AI Studio and QR / Labels remain supporting sections.

## Quick Actions

Overview quick actions jump to the relevant section instead of hiding everything behind one generic event form:

- Log event
- Log water change
- Log feeding
- Log parameter
- Add inhabitant
- Add equipment
- Add maintenance
- Start medication
- Generate QR
- Upload photo

## Data Flow

Specialized forms create focused records and timeline events together. For example, adding an inhabitant creates or updates an `AquariumItem` and creates a `LIVESTOCK_ADDITION` or `PLANT_ADDITION` event. Logging water parameters creates `WaterParameterReading` rows and a `TEST_RESULT` timeline event.

Historical records are not hard-deleted from normal aquarium workflows. Quantity reductions and medication course status changes preserve the inventory/course records and add timeline events.

Photo uploads may optionally create a `PHOTO` event or attach to an existing event/item. They create a pending `MediaAsset` and `ModerationReview`; only approved, visible assets render as images.
