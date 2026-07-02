# Public Browse

Fluxpoint public browse is an opt-in, read-only view of a collection and selected aquariums. Nothing is public by default. A collection owner must first enable the public collection profile, then publish individual aquarium profiles and select which inventory rows are safe to show.

Public collection pages live at `/browse/[publicSlug]`. Public aquarium pages live at `/browse/[publicSlug]/aquariums/[aquariumSlug]`. Authenticated aquarium workspaces include a preview route so keepers can review the public rendering before publishing.

## Privacy model

Public browse uses dedicated public profile records instead of reusing authenticated workspace payloads. The public serializers intentionally omit vendors, unit prices, purchase history, private notes, audit logs, AI logs, admin state, and unpublished inventory rows.

Public media is conservative. Cover images only render when the media asset is approved by moderation, not hidden, and not marked private. If a tank has no safe cover image, the public page renders a styled fallback.

## Collection controls

Collection owners can configure:

- whether public browse is enabled;
- public slug and display copy;
- location disclosure: hidden, region-only, or city/state/country;
- whether owner name, tank list, metrics, timeline, equipment, and QR landing pages are visible;
- whether public pages may be indexed by search engines.

Search indexing remains `noindex` unless the collection explicitly opts in.

## Aquarium controls

Each aquarium has its own public profile with a publish toggle, slug, public title/subtitle/description, and section toggles. Public item rows are selected explicitly from the aquarium inventory. This keeps livestock, plants, equipment, substrate, and hardscape private until the keeper chooses to publish them.

Public pages can show selected inhabitants, plants, equipment/hardscape, latest water readings, and selected timeline highlights. Operational details such as cost, vendor, internal notes, care schedules, alerts, and conditions remain authenticated-only unless a future public profile explicitly adds them.

## QR behavior

Logged-in users who can access the collection continue to scan QR labels into authenticated Fluxpoint pages. Anonymous scans resolve to public pages only when the collection has public browse enabled, QR landing pages enabled, and the target tank or item is published. Private or unpublished QR scans land on a friendly access-denied page instead of leaking record data.

## Implementation notes

Public browse is backed by `CollectionPublicProfile`, `AquariumPublicProfile`, and `AquariumItemPublicProfile`. These models are intentionally separate from the main operational models so public visibility can evolve toward per-collection and per-record controls without changing private workspace behavior.
