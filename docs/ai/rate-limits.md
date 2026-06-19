# Eddy AI rate limits

Fluxpoint applies database-backed limits to every structured Eddy provider attempt, including the mock provider. Restarts do not reset usage.

`src/domains/eddy/eddy-features.ts` is the feature registry and source of default limits, cost tiers, provider requirements, and action mappings. `src/domains/eddy/rate-limits.ts` resolves environment and database overrides, evaluates UTC daily/monthly windows, and reserves user and collection usage in a serializable transaction immediately before a provider attempt.

Three counters are reserved for each attempted request:

- daily user usage;
- daily collection usage;
- monthly collection usage.

Validation and authorization failures do not count. Provider failures count after the provider attempt is reserved. `AiRequestLog.providerAttempted` records that boundary; `featureKey`, token counts, and image count support operations review. Blocked requests are logged with `BLOCKED` status without incrementing usage.

Limits are controlled by `AI_RATE_LIMITS_ENABLED` and the `EDDY_*_LIMIT*` variables in the environment examples. Feature-specific image and husbandry limits take precedence over general defaults. `AiRateLimitOverride` supports future user/collection administration without exposing API keys.

Server Maintenance shows enabled features, current user and collection use, remaining quota, and recent structured Eddy requests. High-cost cover image generation displays its remaining daily quota before submission.
