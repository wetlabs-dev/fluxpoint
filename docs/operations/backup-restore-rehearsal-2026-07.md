# Backup and restore rehearsal — July 2026

Date: 2026-07-10
Environment: isolated Compose project `fluxpoint-remediation`; disposable PostgreSQL and file volumes; no production database or storage.

## Result

The final PostgreSQL 16 backup and restore rehearsal succeeded. The first rehearsal exposed a client/server mismatch: Alpine's unversioned PostgreSQL client produced a dump containing `transaction_timeout`, which PostgreSQL 16 could not restore. The tools image is now pinned to `postgresql16-client`; a new backup restored cleanly into a fresh PostgreSQL 16 volume.

## Final backup

- folder: `fluxpoint-20260710T225154Z-134og5f0`
- database: custom-format `fluxpoint.dump`
- uploads: gzip tar archive
- labels: gzip tar archive
- reports: gzip tar archive
- manifest and per-artifact SHA-256 checksums were produced by the backup service
- backup worker status: `COMPLETE`

The earlier measured rehearsal backup was approximately 556 KB for PostgreSQL and 438 KB for uploads; labels and reports were empty fixture archives. The final archive was generated after pinning the PostgreSQL 16 client.

## Restore steps

1. Started `restore-db` with a separate named PostgreSQL volume and port `55433`.
2. Removed the `?schema=public` Prisma query parameter from the CLI restore URL.
3. Ran `pg_restore --no-owner` against the final dump.
4. Extracted uploads, labels, and reports into separate restore-only named volumes.
5. Compared source and restored database counts.

## Verification

| Record | Source | Restored |
|---|---:|---:|
| Users | 7 | 7 |
| Collections | 3 | 3 |
| Aquariums | 8 | 8 |
| Media assets | 1 | 1 |
| AI jobs | 1 | 1 |
| Worker runs | 500 | 423 |

Worker-run count differs intentionally because workers continued writing after the backup snapshot. Restored files contained two upload artifacts and empty label/report fixture roots. The restored database retained authentication records, collections, aquariums, media metadata, AI job history, and the worker history present at snapshot time.

No production volume was mounted or modified.
