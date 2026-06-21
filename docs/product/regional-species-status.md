# Regional species status

Fluxpoint models invasive, ecological, and regulatory status as regional context—not as a universal checkbox on a species. A `SpeciesRegionalStatus` belongs to one collection and one species definition, and keeps a snapshot of the collection locality used when it was checked. The same species can therefore have different records in different countries or regions.

Statuses are:

- **Unknown**: no reliable regional result is available.
- **Not listed locally**: no known listing was found for the configured locality; this is not proof that no rule exists.
- **Watchlist**: monitored or potentially concerning.
- **Established non-native**: present outside its native range but not necessarily regulated.
- **Potentially invasive**: considered ecologically harmful or invasive in the region.
- **Restricted**: possession, sale, transport, or trade may be limited.
- **Prohibited**: possession, sale, transport, or release may be prohibited.

These records are advisory and are not legal advice. Listings and rules change. Keepers should verify current requirements with the relevant wildlife, agriculture, fisheries, biosecurity, or environmental authority before acquiring, moving, selling, or disposing of a concerning species.

Never release aquarium plants, animals, substrate, or water into local waterways.

## Locality and global use

Regional checking requires a country plus at least one city/locality, region, or postal code. Postal code is optional, and no precise address is requested. Fluxpoint uses globally applicable fields, for example:

- United States: city, state, and country code.
- United Kingdom: town, county, and country code.
- Australia: suburb, state, and country code.
- Canada: city, province, and country code.
- European countries: city, region, and country code.

Country is stored as a two-letter ISO code where supplied. The locality snapshot makes it clear which place an older status applies to even after collection settings change.

## Eddy and manual review

Species Magic Fill can draft a regional status only when minimum locality is configured. Without it, Eddy returns **Unknown** and asks the keeper to add collection locality. Eddy must remain globally aware, expose uncertainty, and avoid guaranteed legal conclusions. Every draft remains review-before-save and supports manual source, scope, confidence, notes, and URL edits.

Inventory and aquarium workflows warn for concerning statuses. Watchlist, established non-native, and invasive records warn without blocking. Restricted and prohibited records require explicit confirmation by a Collection Owner or Server Admin, and Fluxpoint audits the override.
