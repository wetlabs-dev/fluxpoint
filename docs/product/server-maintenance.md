# Server Maintenance

Server Maintenance surfaces operational health, metrics, storage, maintenance mode, backups, restore planning, notification state, audit history, and worker runs for server administrators.

Worker cards distinguish disabled optional services from enabled services that have never run, are stale, running, healthy, or failed. `/server-maintenance/ai-jobs` provides backlog age and counts by priority, claim identity, sanitized payload/result inspection, event timelines, safe failures, media links, retry/cancel controls, and pending-job reprioritization. No queued work and a disabled optional worker remain informational; an old HIGH backlog or growing dead-letter count warrants operator attention.

Health checks can be `OK`, `INFO`, `WARNING`, or `CRITICAL`. `INFO` is visible on the maintenance page for useful operational context, but it is not treated as an alerting severity. The headline open-finding count and server-health notification producer count only `WARNING` and `CRITICAL` incidents/checks.

Server-health email and push notifications are delivered only for:

- open `WARNING` server incidents
- open `CRITICAL` server incidents

The Aquarium Intelligence worker is run with `npm run worker:intelligence`. It scans active aquariums, skips current assessments, refreshes stale deterministic health/parameter/timeline results, and records status in `ServerWorkerRun`. Worker failure is operational status; it does not mark an aquarium unhealthy.
- failed backup runs

`INFO`, `OK`, and not-configured informational states should stay visible in the UI without sending email or push alerts. Delivery still uses the normal notification preference, delivery log, dedupe, and dead-subscription cleanup pipeline.
