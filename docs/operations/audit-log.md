# Audit Log

Fluxpoint records durable, chronological audit events for sensitive and meaningful changes. The design follows the useful collection-scoping and actor-snapshot patterns in [wetlabs-dev/AxilDB](https://github.com/wetlabs-dev/AxilDB), adapted for aquarium operations and Fluxpoint server administration.

## Access

- Server administrators can search and filter every event at `/server-maintenance/audit-log`.
- Collection Owners can view only their active collection at `/collection/audit-log`.
- Aquarists, Fishkeepers, and Viewers cannot open an audit log.
- Collection reads are always constrained by `collectionId`; server and other collections are never included.

The server view supports date, scope, collection, actor, entity, action, severity, and free-text filters with paginated results. Each row includes the timestamp, actor snapshot, action, entity, collection, summary, severity, scope, and expandable structured details.

## Data recorded

`AuditLog` retains actor ID when possible plus snapshot fields for email, display name, and role. The snapshots remain readable if the actor is later deleted. Collection events retain collection scope, while workers and provider callbacks may use a null actor and `SYSTEM` scope. Server administration uses `SERVER`; account and authentication events use `USER`.

Coverage includes authentication and password lifecycle events, user and collection administration, membership and invitation changes, aquariums, inventory and transfers, equipment, quarantine, species and husbandry, lighting, timeline and medication records, water readings and metric thresholds, media and moderation, Eddy and AI requests, email and push delivery, backups, restore planning, incidents, maintenance mode, and application reset.

Audit history begins when the migration is installed. Old application activity is not reconstructed.

## Sanitization

All writes go through the worker-safe `src/domains/audit/audit-service.ts`; permission-enforced reads live in `src/domains/audit/audit-read-service.ts`. `sanitizeAuditDetails` recursively redacts values whose keys contain password, token, secret, API key, private key, session, cookie, authorization, SMTP password, VAPID private key, OpenAI key, AWS secret, or database URL. Redacted values are stored as `[REDACTED]`.

The sanitizer also limits depth, object keys, array length, and string length. AI audit events store request type, provider, status, duration, token counts, and entity references—not full prompts or responses. Push endpoints and cryptographic subscription keys are never included.

## Adding an event

Use a named constant from `src/domains/audit/audit-events.ts` where one exists, then call the narrowest helper:

```ts
await auditCollectionAction({
  collectionId,
  actorUserId: user.id,
  entityType: "Aquarium",
  entityId: aquarium.id,
  action: AUDIT_EVENTS.AQUARIUM_UPDATED,
  summary: `Updated ${aquarium.name}`,
  before,
  after: aquarium
});
```

Use `auditServerAction` for server administration, `auditUserAction` for account/security activity, and `auditSystemEvent` for actorless workers. `createAuditLog` and the compatibility alias `writeAuditLog` infer collection ID, severity, scope, and summary when possible, but destructive or unusual events should provide them explicitly.

Never write directly with `prisma.auditLog.create`. Never pass credentials, raw headers, AI prompts, generated responses, private media data, or provider secrets to an audit helper.
