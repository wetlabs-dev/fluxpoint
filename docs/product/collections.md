# Collections and active context

Collections scope aquariums, inventory, species terminology, roles, audit history, and regional context.

Fluxpoint uses one active collection per signed-in user. `User.activeCollectionId` persists the selection. The server accepts a selection only when the collection is active and the user has a membership, or the user is a server administrator. If membership is removed or the collection is archived, the next request falls back to the oldest accessible active collection and persists that fallback.

The application shell shows the selector only when more than one collection is accessible. List routes remain on their equivalent path after a switch. Entity/detail routes return to `/dashboard` so an aquarium or inventory identifier is never carried into another collection.

## Collection locality

Collection settings support an approximate city/locality, state/province/region, two-letter country code, optional postal code, display label, and notes. A street address is neither requested nor required. The information supports regional species-status checks and leaves room for future weather-aware care and local alerts.

Country remains optional for normal Fluxpoint use. Regional status lookup becomes available only when country and at least one city, region, or postal code are present. Examples include town/county/country in the United Kingdom, suburb/state/country in Australia, city/province/country in Canada, and city/region/country across European countries.

Only collection owners can edit locality. Changes are recorded in the collection audit log. Existing regional-status records retain their locality snapshot and should be re-checked when a collection moves.
