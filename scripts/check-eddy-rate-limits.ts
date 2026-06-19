import assert from "node:assert/strict";
import { eddyWindowBounds, evaluateEddyLimits, type EddyResolvedFeatureConfig } from "../src/domains/eddy/rate-limits";
import { EddyValidationError, validateEddyInput } from "../src/domains/eddy/eddy-service";

const config: EddyResolvedFeatureConfig = { featureKey: "TANK_SUMMARY", label: "Tank summaries", enabled: true, dailyUserLimit: 2, dailyCollectionLimit: 3, monthlyCollectionLimit: 10, costTier: "LOW", requiresOpenAI: false, requiresImageModel: false, requiresModeration: false };
const now = new Date("2026-06-19T23:30:00.000Z");

assert.equal(evaluateEddyLimits({ config, dailyUserUsed: 0, dailyCollectionUsed: 0, monthlyCollectionUsed: 0, now, rateLimitsEnabled: true }).allowed, true, "first request should be allowed");
assert.equal(evaluateEddyLimits({ config, dailyUserUsed: 2, dailyCollectionUsed: 2, monthlyCollectionUsed: 2, now, rateLimitsEnabled: true }).reason, "DAILY_USER", "daily user limit should block");
assert.equal(evaluateEddyLimits({ config, dailyUserUsed: 1, dailyCollectionUsed: 3, monthlyCollectionUsed: 3, now, rateLimitsEnabled: true }).reason, "DAILY_COLLECTION", "daily collection limit should block");
assert.equal(evaluateEddyLimits({ config: { ...config, enabled: false }, dailyUserUsed: 0, dailyCollectionUsed: 0, monthlyCollectionUsed: 0, now, rateLimitsEnabled: true }).reason, "FEATURE_DISABLED", "disabled feature should block");
assert.equal(eddyWindowBounds(now).dailyReset.toISOString(), "2026-06-20T00:00:00.000Z", "daily window should reset at UTC midnight");
assert.equal(eddyWindowBounds(now).monthlyReset.toISOString(), "2026-07-01T00:00:00.000Z", "monthly window should reset on the first UTC day");
assert.throws(() => validateEddyInput("compatibility", {}), EddyValidationError, "validation should reject before usage reservation");
validateEddyInput("compatibility", { proposal: "Honey gourami" });

console.log("Eddy rate-limit checks passed.");
