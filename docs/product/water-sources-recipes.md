# Water sources and recipes

Fluxpoint models water preparation as collection-scoped source and recipe records.

- `WaterSource` describes source water such as RODI, dechlorinated tap, well, rain, spring, mixed, or other water. It can store baseline pH, GH, KH, TDS, salinity, notes, and a default/common-use flag.
- `WaterRecipe` belongs to one source and stores optional target pH, GH, KH, TDS, salinity, notes, and an active/archive flag.
- `WaterRecipeAdditive` stores repeatable additive dosing: additive name, optional linked inventory item, dose amount/unit, per-volume amount/unit, instructions, and sort order.

New starter collections are seeded with **RODI** and **Dechlorinated Tap**. Normal page loads do not recreate deleted water sources, so unused starter definitions can be permanently removed. Legacy `AquariumProfile.waterSource` free text is preserved and migrated into structured water-source rows where possible.

Aquariums reference sources and recipes with `Aquarium.waterSourceId` and `Aquarium.waterRecipeId`. The old profile text remains a compatibility field only; new aquarium forms use structured selects. Selecting a recipe does not automatically overwrite the aquarium target profile because recipe targets and aquarium targets answer different questions.

Aquarium overview pages include a water recipe calculator. It scales each additive with:

`input volume converted to additive per-volume unit / additive per-volume amount * dose amount`

One gallon is treated as 3.78541 liters. The calculator is advisory only and always reminds keepers to verify mixed water with tests.

Eddy receives the selected source, recipe targets, and saved additive dose structure as context. When a saved recipe exists, Eddy should treat that recipe as authoritative and not invent alternative dosing unless the keeper explicitly asks to design or revise a recipe.
