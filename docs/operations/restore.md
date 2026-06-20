# Restore Planning

Fluxpoint deliberately does not restore from the browser. Selecting a complete backup validates its database record, folder, artifact sizes, manifest, and maintenance-mode state. Creating a restore plan stores that validation plus operator commands in `RestorePlan` and `AuditLog`; it executes nothing.

An operator should review the plan, announce and enable maintenance mode, take a fresh safety backup, stop application and worker traffic, run the generated `pg_restore` and archive extraction commands from the server root, restart Fluxpoint, then run production checks. The generated command removes Prisma's `schema` query parameter before passing the database URL to PostgreSQL tools.

Restore history is planning history only. Marking future plans complete must remain an explicit operator reconciliation step after the out-of-band restore succeeds.
