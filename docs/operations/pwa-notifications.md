# PWA and notifications

Fluxpoint is an installable Progressive Web App with optional email and Web Push alerts. Version 1 intentionally uses a push-only service worker: it handles push events and notification clicks, but does not cache pages or provide offline data access.

## PWA installation

The manifest is served from `/manifest.webmanifest`; the service worker is `/sw.js`. Fluxpoint registers the worker globally in supported secure browsers. The 192, 512, 1024, maskable, and Apple touch assets use the Eddy app mark.

Production installation and push require HTTPS. Desktop and Android browsers normally expose an install action from the browser UI. On iPhone and iPad, use Safari's **Add to Home Screen** first; Web Push permission is only available to an installed Home Screen web app on supported iOS versions.

## Web Push and VAPID

Generate a VAPID key pair:

```bash
npx web-push generate-vapid-keys
```

Configure:

```dotenv
NEXT_PUBLIC_ENABLE_WEB_PUSH=true
NEXT_PUBLIC_VAPID_PUBLIC_KEY=public-key
VAPID_PRIVATE_KEY=private-key
VAPID_SUBJECT=mailto:admin@example.com
```

Only the public key is exposed to the browser. Keep `VAPID_PRIVATE_KEY` server-only. Restart/rebuild the app and reminder worker after changing public build-time variables.

## User preferences and devices

Account Settings separates Email and Push for care, maintenance, medication, quarantine, water tests, metric thresholds, server health/backups, and the weekly Eddy digest. Preferences are per user. Timezone and quiet hours apply to push; email is not delayed by quiet hours.

The Web Push panel reports browser support and permission state. A user can enable the current device, send a test push, view registered devices, or revoke any owned device. All subscription API routes require authentication and scope reads/writes to the current user.

## Worker behavior

The existing reminders worker scans on `REMINDER_WORKER_INTERVAL_MS` (default five minutes) when `ENABLE_REMINDERS_WORKER=true`. It produces:

- due care, overdue maintenance, dosing, and water-test alerts from care tasks;
- calculated follow-up medication alerts from active course intervals;
- daily active-quarantine checks;
- threshold alerts from the latest enabled aquarium metrics;
- open server incident and failed-backup alerts for server admins;
- one Eddy digest per ISO week when enabled.

`NotificationDelivery` guards each user/channel/alert period against duplicate sends and records attempts, failures, and provider state. Failed deliveries can retry after 15 minutes. Push endpoints returning HTTP 404/410 are revoked immediately; repeatedly failing subscriptions are disabled. Worker ticks continue to use `ServerWorkerRun`, so Server Maintenance shows both worker health and recent notification delivery state.

Email delivery uses Fluxpoint's existing console/SES provider and `EmailLog`. Push payloads contain a short generic summary and a Fluxpoint URL, not free-form aquarium notes or user data.

## Troubleshooting

- **Push unavailable:** confirm HTTPS (localhost is the development exception), all three VAPID values, and `NEXT_PUBLIC_ENABLE_WEB_PUSH=true` at build time.
- **Permission denied:** reset the site's notification permission in the browser; Fluxpoint cannot override a denial.
- **iOS has no permission prompt:** install Fluxpoint to the Home Screen and open the installed app.
- **No alerts:** enable the alert's channel in Account Settings and run the reminders worker profile.
- **Device stopped receiving:** revoke and re-enable it; Server Maintenance shows delivery failures and revoked-device counts.
- **Offline use:** not supported in v1. No application responses are cached by the service worker.
