# Authentication and first setup

Fluxpoint's first administrator is created by the bootstrap process from the configured admin environment variables. The login page only shows first-time setup guidance when the database is empty or when a single enabled server administrator exists and has never logged in.

After the first login, the login page switches to normal account-copy. This prevents production users from seeing bootstrap credential hints after the system is already initialized.

## Account requests

Visitors can request access from `/request-account`, linked from the login page as a secondary action. The request flow is intentionally not open signup: it records the name, normalized lowercase email, optional requested collection text, message, IP, and user agent, then always returns a generic confirmation. Duplicate pending requests for the same email and daily per-email/per-IP limits prevent request spam without revealing whether an account already exists.

Server administrators review requests at **Server Maintenance → Account requests**. Approval requires an explicit site role plus collection membership. Existing users are enabled/updated and granted the selected membership. New users receive a secure collection invitation link; the invite page lets them create their password and accepts the invitation in one step. Fluxpoint never emails plaintext passwords.

Rejections can optionally email the requester with the entered reason. Email delivery is best effort: requests remain durable and reviewable even when the email provider is not configured.
