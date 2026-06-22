# Server Maintenance

`/server-maintenance` is restricted to the configured `ADMIN_EMAIL` (or the first user when no admin email is configured). It combines real health checks, recent worker runs, operational audit logs, incidents, storage estimates, maintenance mode, backups, and restore plans. `/settings` redirects to this page.

The metrics worker runs when `ENABLE_METRICS_WORKER=true`. `SERVER_METRICS_ENABLED=true` allows it to persist RAM, filesystem, `/proc/net/dev` network totals, database size, storage categories, and collection estimates in `ServerMetricSnapshot` and `StorageEstimate`. Snapshots are retained for `SERVER_METRICS_RETENTION_HOURS`, 48 hours by default.

Memory incidents require three consecutive samples above 75 percent warning or 90 percent critical. Disk incidents open immediately above 80 percent warning or 90 percent critical. Clear samples resolve the matching open incident. Worker failures create incidents and a later successful run resolves them.

Health checks are not optimistic placeholders: the page tests PostgreSQL, required user/collection records, writable uploads/labels/reports/backups directories, and AI/email configuration. Missing optional providers render warnings. Disabled workers and absent snapshots are labeled as such.

Host container inspection is intentionally disabled: Fluxpoint does not mount the Docker socket into the app container. The Container runtime check is informational, does not increase warning or actionable-finding totals, and directs operators to `docker compose ps` on the host.

Maintenance mode is database-backed. Non-admin authenticated app users see the maintenance screen; the configured server administrator retains access. Changes include an optional keeper message and expected-return time and are audited.
