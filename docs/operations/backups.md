# Sitewide Backups

Administrators request backups from `/server-maintenance`. The request and run are persisted before work begins. With `ENABLE_BACKUPS_WORKER=true`, the backup worker processes the oldest queued request and creates `backups/fluxpoint-{timestamp}-{request}`.

Each complete folder contains:

- `fluxpoint.dump`, a custom-format PostgreSQL dump;
- `uploads.tar.gz`;
- `labels.tar.gz`;
- `reports.tar.gz`;
- `manifest.json` with artifact sizes and SHA-256 checksums.

`BackupArtifact` rows mirror the durable contents. Completion, failure, deletion, and cleanup are audited. Cleanup previews only complete backups older than `BACKUP_RETENTION_DAYS`; applying it requires typing `DELETE`. Active backup runs are never deleted.

The backup worker needs the Compose mounts for `backups`, `public/uploads`, `public/labels`, and `public/reports`. Start it with:

```bash
docker compose --profile workers up -d --build backups
```
