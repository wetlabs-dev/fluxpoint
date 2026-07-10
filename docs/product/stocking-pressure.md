# Stocking Pressure

Stocking Pressure is a manually requested Eddy estimate on an aquarium profile. It compares the saved tank volume, active inhabitants and quantities, linked species context, plants, and attached filtration. The result is deliberately qualitative: Very light, Light, Moderate, Heavy, Overstocked, or Unknown. Fluxpoint does not expose a percentage, faux-precise capacity score, or an inch-per-gallon rule.

Each saved estimate includes a Low, Medium, or High data-confidence label, up to four interpretive flags, concise reasoning, missing-data notes, and the required reminder that the estimate is not a substitute for water testing or observation. Confidence describes the completeness of the saved records, not certainty about aquarium biology.

## Manual refresh and staleness

Fluxpoint stores estimate history and never refreshes it in the background. A deterministic fingerprint covers the saved volume and dimensions, active aquarium inhabitants, quantities, linked species context, plants, and attached filters. Changing any of those inputs marks the latest result stale and enables **Refresh with Eddy**; it does not spend an AI call automatically. An unchanged estimate cannot be requested again.

Dead, removed, transferred, archived, consumed, storage-only, and unrelated quarantine inventory is excluded. Quarantine inventory is included only for its assigned quarantine aquarium. Multiple attached filters are retained individually. Filter brand, model, profile notes, and attachment notes are used when present; missing flow or capacity data lowers confidence.

Plants modestly reduce estimated nutrient pressure and may produce Plant-assisted or High plant mass flags. They cannot cancel severe animal stocking, replace filtration, or remove the need for maintenance. Adding adult-size context, linked species, accurate quantities, and filter details improves confidence.

The mock provider follows the same response schema and produces conservative deterministic results for development. Requests use the `AQUARIUM_STOCKING_PRESSURE` Eddy feature and normal per-user and per-collection limits; `EDDY_STOCKING_PRESSURE_DAILY_USER_LIMIT` overrides its default personal daily limit. Successful estimates, failures, and rate limits are recorded in AI request and audit history. The latest saved estimate is also included in Eddy aquarium context and livestock detail sheets.

Aquarium Intelligence reuses the latest saved Stocking Pressure result rather than creating a competing bioload calculation. Stale, unknown, heavy, or overstocked Stocking Pressure lowers confidence or raises the stocking domain state; light and moderate current estimates can count as favorable evidence.

## Additional tank contents

Stocking Pressure includes enabled `AquariumAdditionalContent` rows in the input fingerprint and summary, but only as qualitative context. Additional plant notes may modestly support the “planted tank” interpretation when substantial; they never cancel heavy animal pressure. Additional hardscape notes can influence territory, swimming-space, and line-of-sight reasoning. Unknown fish or invertebrate rows increase missing-data/uncertainty and can move the estimate more conservative, but Fluxpoint does not convert approximate notes into exact bioload math.

If those contents matter operationally, convert them manually into Inventory first so the estimate can use species, quantity, bioload, size, and placement checks.
