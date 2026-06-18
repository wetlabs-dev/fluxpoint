# Medication System

Fluxpoint separates medication definitions from medication courses and dose events.

## Medication Definitions

Medication definitions live at `/medications` and belong to a collection. They describe reusable label information:

- name
- manufacturer
- medication type
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
