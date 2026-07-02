# Privacy

Fluxpoint treats collection records as private operational data unless a keeper explicitly publishes a public view.

Public Browse uses a dedicated safe serialization path. Public pages do not expose purchase prices, vendors, acquisition notes, private notes, audit logs, server/admin state, AI request logs, internal identifiers, or unpublished inventory rows. Media must be approved and non-private before it can appear on a public aquarium page.

Anonymous QR scans do not bypass privacy. A scan only resolves to a public page when the collection public profile is enabled, QR landing pages are enabled, and the target aquarium or item is published. Otherwise the visitor sees an access-denied message and is invited to sign in.

Search engine indexing is opt-in. Public pages send `noindex` unless the collection owner explicitly enables indexing in Public Browse settings.
