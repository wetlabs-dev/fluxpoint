# Aquarium Detail Workspace

`/aquariums/[id]` is Fluxpoint's primary tank workspace. It is organized around aquarium operations rather than database tables.

## Tabs

- Overview: tank identity, status, volume, calculated volume estimate, location, age, selected equipment, latest readings, recent events, and due care tasks.
- Inhabitants: fish, invertebrates, plants, and coral/other living records from `AquariumItem` and optional `SpeciesDefinition` links.
- Equipment: assigned tank equipment, lighting assignment, and equipment/tank maintenance logging.
- Metrics: manual water-test batch entry, latest readings, Prometheus metric names, thresholds, ingestion tokens, and managed graph panel status.
- Timeline: durable event history with structured event detail cards.
- Schedules: feeding, active medications, pending care tasks, and care history.
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

## Data Flow

Specialized forms create focused records and timeline events together. For example, adding an inhabitant creates or updates an `AquariumItem` and creates a `LIVESTOCK_ADDITION` or `PLANT_ADDITION` event. Logging water parameters creates `WaterParameterReading` rows and a `TEST_RESULT` timeline event.

Historical records are not hard-deleted from normal aquarium workflows. Quantity reductions and medication course status changes preserve the inventory/course records and add timeline events.
