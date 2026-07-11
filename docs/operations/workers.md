# Worker operation and health

Recurring workers use the `workers` Compose profile and their individual `ENABLE_*_WORKER` flag. Disabled optional workers are informational, not warnings.

Every tick uses a deterministic PostgreSQL advisory transaction lock. If another process owns the lock, the tick is recorded as safely skipped. Queue-like domains retain their own row claims and idempotency; the advisory lock is an additional deployment guard, not a replacement for them.

Server Maintenance classifies workers as `DISABLED`, `NEVER_RUN`, `HEALTHY`, `STALE`, `RUNNING`, or `FAILED`. An enabled worker becomes stale after three configured intervals, with a minimum five-minute grace. Only warning/critical incidents are notification candidates; information state and restarts do not generate health alerts.

Start optional workers with `docker compose --profile workers up -d --build`.
