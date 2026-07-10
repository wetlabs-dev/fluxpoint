# Notifications

Fluxpoint notifications use email and optional Web Push preferences per user. Delivery goes through `NotificationDelivery`, which deduplicates each user/channel/dedupe key and records sent, skipped, and failed attempts.

Aquarium Intelligence adds these preference rows:

- Aquarium health becomes critical
- Aquarium health worsens to concerning
- Significant parameter drift
- Parameter instability
- Aquarium Intelligence failures
- Weekly Aquarium Intelligence digest

The intelligence worker and shared reminder worker use existing notification plumbing. Drift and instability alerts are sent only for saved deterministic analyses that reach concern or critical state, and dedupe keys use the saved analysis or assessment id so repeated worker runs do not send the same unresolved alert again.

Worker failures are operational notifications for server administrators. They do not mark aquariums unhealthy.
