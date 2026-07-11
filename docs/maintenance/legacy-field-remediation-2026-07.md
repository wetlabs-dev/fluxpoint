# Legacy field remediation — July 2026

## Removed

`Aquarium.generatedName` was removed. `Aquarium.name` is canonical, Eddy rename acceptance already writes `name`, and repository-wide searches found no runtime reader or writer. Migration `20260710160000_post_audit_hardening` drops the column. The disposable populated migration and `check:legacy-field-integrity` confirmed the column is absent.

## Retained with evidence

- `Aquarium.salinity`: active summary, Eddy context, form synchronization, and compatibility readers remain. Target min/max are canonical, but populated fixtures still contain incomplete target ranges; removal would lose classification context.
- `AquariumProfile` equipment/free-text slots: active aquarium context and display fallbacks remain while attachment records are canonical for owned equipment.
- lighting point channel/ramp columns: active conversion and preview fallbacks remain for schedules whose JSON capability values are incomplete.
- legacy husbandry JSON keys: retained only for historical reads; current forms and Magic Fill use canonical species fields.

These fields were not dropped because the required zero-mismatch/backfill evidence does not yet exist. The integrity command reports remaining incomplete salinity targets; removal requires a later populated-data conversion with zero fallback reads.
