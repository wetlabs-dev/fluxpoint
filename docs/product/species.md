# Species Definitions

Species definitions store a keeper-facing common name, canonical taxonomy, care ranges, salinity compatibility, regional context, aliases, and optional reference metadata. The same definition model supports fish, invertebrates, plants, corals, and other aquatic life.

Taxonomy includes genus, species, variety, cultivar, and an optional author citation. The citation is stored separately from the derived scientific display name so it can be corrected without changing identity matching. Author citations are stored without a single outer wrapper pair, for example `Regan, 1929`; display helpers add contextual parentheses for zoological citations while preserving botanical authorship forms such as `(Blume) Copel.`.

Optional reference links are available for Wikipedia, iNaturalist, and GBIF on every species category. Plants also show Plants of the World Online (POWO). Blank links are valid. Entered links must be complete HTTP or HTTPS URLs; HTTPS is preferred. Reference links are shown on species cards and the species husbandry workspace when present. If an older non-plant record has a POWO value, Fluxpoint preserves it on edit but hides it from normal non-plant forms and cards.

Fish definitions include an optional maximum-size field. It is keeper-facing text rather than a numeric formula so values can be recorded as practical ranges such as `4–5 in` or `10–12 cm`. Eddy Species Magic Fill can draft it for fish, and downstream Eddy tools include it as adult-size context.

Plant definitions include a structured CO₂ requirement in addition to freeform notes. The saved values are **Required**, **Recommended**, **Not needed**, and **Unknown**. Fluxpoint shows this only for plant species because CO₂ requirement is a plant husbandry attribute, not a general animal or coral field. Existing freeform CO₂ notes remain available for context such as low-tech/high-tech caveats.

Create and edit use the same labeled section order: identity, Eddy Magic Fill, references, care ranges, regional status, aliases, and notes. The create panel is full width above the results list so taxonomy and Magic Fill review are not constrained to a side rail.

Species aliases remain collection-scoped and searchable. Each alias has a visible name, type, notes, and source field. Regional status remains collection-local context rather than a universal taxon property.

Inventory and tank-add flows use species category as a guardrail. Fish inventory shows fish definitions, invertebrate inventory shows invertebrate definitions, and plant inventory shows plant definitions; aquarium placement further narrows choices to species whose salinity range matches the tank target. Selecting a species can fill the inventory display name, but manually edited item names are preserved.
