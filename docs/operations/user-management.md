# User administration

Server administrators manage accounts at **Server Maintenance → Users**.

`SERVER_ADMIN` can manage all users, collections, backups, maintenance mode, and resets. `STANDARD_USER` only receives permissions through collection memberships. Account disablement revokes active sessions; re-enabling preserves the account's memberships. A password reset also revokes active sessions.

Pending access requests are reviewed at **Server Maintenance → Account requests**. Server administrators can approve a request into a specific collection role, optionally grant the server-admin role, or reject it with an optional requester-facing reason. Approval for a new email creates a secure invitation/setup flow rather than a temporary plaintext password.

Permanent deletion requires `DELETE user@example.com`. Fluxpoint blocks deletion of the current account, the last enabled server administrator, and any user who still owns a collection. Transfer or delete owned collections first. Related sessions and memberships follow their schema cascade rules; records designed to retain history use nullable actor references.

The first administrator is created idempotently by bootstrap from `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optional `ADMIN_NAME` when no enabled server administrator exists. Existing administrator credentials are not overwritten on later runs.
