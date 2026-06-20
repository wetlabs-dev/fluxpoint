# Medication System

Fluxpoint separates medication definitions from medication courses and dose events.

## Medication Definitions

Medication definitions live at `/medications` and belong to a collection. They describe reusable label information:

- name
- manufacturer
- medication type
- structured dose amount/unit per gallon volume
- optional repeat interval, course length, and water-change guidance
- active ingredients
- concentration
- default dose amount and unit
- dose per gallons
- schedule notes
- safety notes
- contraindications

Definitions are retained if they have historical courses.

## Medication Courses

A medication course belongs to one aquarium and one medication definition. Starting a course records:

- reason
- tank volume used for dose planning
- calculated or manually entered dose
- dose unit
- schedule notes
- course status

Starting a course creates a `MEDICATION` timeline event.

Starting a course also records dose 1 as `TREATMENT_START`, snapshotting both the calculated recommendation and the confirmed/overridden administered amount. Later doses are typed as one-off, follow-up, or treatment completion. A completion dose closes the linked course. These snapshots preserve what Fluxpoint recommended at the time even if the medication definition changes later.

The aquarium form previews the volume-scaled recommendation before submission alongside repeat interval, course length, and water-change guidance. The keeper must confirm the actual amount and unit. A one-off selection creates the same durable course/dose history but closes the course immediately.

## Dose Scaling

When a definition has both `defaultDoseAmount` and `dosePerGallons`, Fluxpoint calculates:

```txt
calculated dose = tankVolumeGallons / dosePerGallons * defaultDoseAmount
```

If tank volume is missing, the user must enter the volume used. If the definition lacks dose scaling, the user must enter a manual dose.

Fluxpoint always shows the safety warning:

```txt
Verify medication label directions before dosing.
```

Stored dose values are planning aids, not medical instructions.

## Dose Events

Each logged dose creates:

- an `AquariumEvent` of type `MEDICATION`
- a linked `MedicationDoseEvent`

Completing or cancelling a course also creates a `MEDICATION` timeline event so the tank history remains coherent.
