# Server Maintenance

Server Maintenance surfaces operational health, metrics, storage, maintenance mode, backups, restore planning, notification state, audit history, and worker runs for server administrators.

Health checks can be `OK`, `INFO`, `WARNING`, or `CRITICAL`. `INFO` is visible on the maintenance page for useful operational context, but it is not treated as an alerting severity. The headline open-finding count and server-health notification producer count only `WARNING` and `CRITICAL` incidents/checks.

Server-health email and push notifications are delivered only for:

- open `WARNING` server incidents
- open `CRITICAL` server incidents
- failed backup runs

`INFO`, `OK`, and not-configured informational states should stay visible in the UI without sending email or push alerts. Delivery still uses the normal notification preference, delivery log, dedupe, and dead-subscription cleanup pipeline.
