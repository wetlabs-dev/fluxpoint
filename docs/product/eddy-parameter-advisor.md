# Eddy Parameter Advisor

Eddy Parameter Advisor is a tank-specific decision-support tool in the aquarium Eddy workspace and target-profile settings. It compares saved target ranges with every active, assigned inventory item that has a linked species definition. It never changes targets until an authorized keeper explicitly applies selected recommendations.

## Deterministic analysis

Before any provider call, Fluxpoint collects complete saved species ranges for temperature, pH, GH, KH, salinity, and TDS when TDS exists in effective husbandry fields. For each parameter it records the shared intersection, broad union, missing species data, and whether the ranges conflict. Ammonia and nitrite are constrained to 0 ppm. Nitrate is treated as an upper safety threshold rather than a desired concentration.

Eddy receives only a concise aquarium summary, active stocking, overlap results, current targets, latest readings, and short summaries of active conditions, medications, losses, and timeline context. It interprets that evidence into structured recommendations, cautions, missing-data notes, and stocking conflicts. Mock-provider mode uses the same deterministic analysis without OpenAI.

## Applying advice

Only non-conflicting `ADJUST` recommendations with validated numeric bounds can be selected. Conflict and missing-data rows cannot be one-click applied. Applying a reviewed recommendation updates the aquarium target profile, synchronizes metric thresholds, records a `PARAMETER_TARGETS_UPDATED` timeline event, and writes before/after audit details. TDS is applied to its existing metric configuration because Fluxpoint does not currently model TDS on `AquariumProfile`.

Eddy’s parameter advice is based on saved species profiles and stocking records. It is not a guarantee. Verify sensitive changes, prioritize stability, and adjust pH, GH, KH, salinity, and temperature gradually.
