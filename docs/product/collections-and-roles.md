# Collections and roles

A collection is Fluxpoint's ownership and access boundary. Each collection has one primary owner and must retain at least one `COLLECTION_OWNER` membership.

- **Collection Owner** manages collection settings, members, ownership, and all collection records.
- **Aquarist** manages aquariums, inhabitants, equipment, schedules, husbandry, and records.
- **Fishkeeper** logs daily care, feedings, tests, maintenance, photos, and observations.
- **Viewer** has read-only access.

Server administrators may inspect and manage every collection without a membership. Collection ownership transfers are explicit: the destination user becomes a Collection Owner, the previous primary owner becomes an Aquarist, and the collection's primary owner reference changes in one transaction.

Collection Owners can invite existing accounts as Aquarists, Fishkeepers, or Viewers. The signed-in email must match the invitation email; acceptance creates or updates the membership and consumes the invitation.

Archiving makes a collection unavailable for normal member writes. Permanent deletion requires `DELETE collection name` and cascades through collection-owned records according to the database schema.

Production bootstrap is non-demo by default. Set `DEMO_SEED=true` only when sample species and aquariums are intentionally wanted; repeated bootstrap runs reuse the administrator, collection, membership, workflow templates, and metric definitions.
