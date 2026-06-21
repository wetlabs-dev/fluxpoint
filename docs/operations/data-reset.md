# Application data reset

Fluxpoint can remove aquarium application data without rebuilding PostgreSQL or invalidating preserved sign-in accounts. The reset deletes collections and their dependent aquariums, inventory, care history, schedules, media metadata, AI history, moderation records, and app audit history. Authentication records, server metrics/incidents, and backup records are preserved unless explicitly selected.

## Admin interface

Server administrators can open **Server Maintenance → Data reset**. The page shows current record counts and requires:

- an explicit user-preservation choice;
- the current administrator password;
- the exact phrase `RESET FLUXPOINT`;
- separate choices for files, operational history, and backup metadata.

Take a fresh sitewide backup before a live reset. Backup archives are never removed by the reset interface.

## CLI

Preview the plan first:

```bash
npm run db:reset-app-data -- --dry-run
```

Execute a reset while preserving every login:

```bash
npm run db:reset-app-data -- --confirm-reset
```

Production additionally requires `--i-understand-this-deletes-data`. To delete non-preserved accounts, provide one or more `--preserve-user-email address@example.com` flags plus `--delete-non-preserved-users`. At least one user must remain. Optional flags are `--create-default-collection`, `--delete-files`, `--delete-operational-data`, and `--delete-backup-metadata`.

`--delete-files` only empties Fluxpoint's uploads, labels, and reports directories. It does not touch backup archives. Every completed reset writes a new audit event after prior application audit history is cleared.

## Recovery

If a reset was unintended, enable maintenance mode, validate the latest backup in Server Maintenance, and follow the generated operator restore plan. Fluxpoint never executes database restore commands from the web interface.
