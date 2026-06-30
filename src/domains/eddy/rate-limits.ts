import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { eddyFeatures, type EddyFeatureKey } from "@/domains/eddy/eddy-features";

export type EddyResolvedFeatureConfig = {
  featureKey: EddyFeatureKey;
  label: string;
  enabled: boolean;
  dailyUserLimit: number;
  dailyCollectionLimit: number;
  monthlyCollectionLimit: number;
  costTier: "LOW" | "MEDIUM" | "HIGH";
  requiresOpenAI: boolean;
  requiresImageModel: boolean;
  requiresModeration: boolean;
};

export type EddyUsageWindow = { used: number; limit: number; remaining: number; resetAt: string };
export type EddyUsageStatus = {
  featureKey: EddyFeatureKey;
  label: string;
  enabled: boolean;
  rateLimitsEnabled: boolean;
  allowed: boolean;
  reason?: "FEATURE_DISABLED" | "DAILY_USER" | "DAILY_COLLECTION" | "MONTHLY_COLLECTION";
  dailyUser: EddyUsageWindow;
  dailyCollection: EddyUsageWindow;
  monthlyCollection: EddyUsageWindow;
};

export class EddyRateLimitError extends Error {
  status = 429;
  constructor(public usage: EddyUsageStatus) { super(formatRateLimitError(usage)); }
}

export class EddyFeatureDisabledError extends Error {
  status = 403;
  constructor(public usage: EddyUsageStatus) { super(`${usage.label} are currently disabled.`); }
}

function envLimit(name: string | undefined, fallback: number) {
  if (!name) return fallback;
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function envEnabled(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null) return fallback;
  return value.trim().toLowerCase() !== "false";
}

export function eddyRateLimitsEnabled() {
  return envEnabled("AI_RATE_LIMITS_ENABLED", true);
}

export function eddyWindowBounds(now = new Date()) {
  const dailyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dailyReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const monthlyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthlyReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { dailyStart, dailyReset, monthlyStart, monthlyReset };
}

export async function getEddyFeatureConfig(featureKey: EddyFeatureKey, context?: { userId?: string | null; collectionId?: string | null }): Promise<EddyResolvedFeatureConfig> {
  const feature = eddyFeatures[featureKey];
  const genericUser = envLimit("EDDY_DAILY_USER_LIMIT_DEFAULT", feature.defaultDailyUserLimit);
  const genericCollection = envLimit("EDDY_DAILY_COLLECTION_LIMIT_DEFAULT", feature.defaultDailyCollectionLimit);
  const genericMonthly = envLimit("EDDY_MONTHLY_COLLECTION_LIMIT_DEFAULT", feature.defaultMonthlyCollectionLimit);
  const userOverride = context?.userId ? await prisma.aiRateLimitOverride.findUnique({ where: { scopeKey_featureKey: { scopeKey: `user:${context.userId}`, featureKey } } }) : null;
  const collectionOverride = context?.collectionId ? await prisma.aiRateLimitOverride.findUnique({ where: { scopeKey_featureKey: { scopeKey: `collection:${context.collectionId}`, featureKey } } }) : null;
  const requestedProvider = process.env.AI_PROVIDER?.trim().toLowerCase() || "mock";
  const providerAvailable = !feature.requiresOpenAI || (process.env.AI_ENABLED !== "false" && (requestedProvider === "mock" || (requestedProvider === "openai" && Boolean(process.env.OPENAI_API_KEY))));
  const imageAvailable = !feature.requiresImageModel || process.env.AI_IMAGE_ENABLED !== "false";
  const moderationAvailable = !feature.requiresModeration || process.env.AI_MODERATION_ENABLED !== "false";
  return {
    featureKey,
    label: feature.label,
    enabled: (userOverride?.enabled ?? collectionOverride?.enabled ?? envEnabled(`EDDY_FEATURE_${featureKey}_ENABLED`, feature.enabledByDefault)) && providerAvailable && imageAvailable && moderationAvailable,
    dailyUserLimit: userOverride?.dailyUserLimit ?? collectionOverride?.dailyUserLimit ?? envLimit(feature.userLimitEnv, genericUser),
    dailyCollectionLimit: userOverride?.dailyCollectionLimit ?? collectionOverride?.dailyCollectionLimit ?? envLimit(feature.collectionLimitEnv, genericCollection),
    monthlyCollectionLimit: userOverride?.monthlyCollectionLimit ?? collectionOverride?.monthlyCollectionLimit ?? genericMonthly,
    costTier: feature.estimatedCostTier,
    requiresOpenAI: feature.requiresOpenAI,
    requiresImageModel: feature.requiresImageModel,
    requiresModeration: feature.requiresModeration
  };
}

export function evaluateEddyLimits(input: { config: EddyResolvedFeatureConfig; dailyUserUsed: number; dailyCollectionUsed: number; monthlyCollectionUsed: number; now?: Date; rateLimitsEnabled?: boolean }): EddyUsageStatus {
  const bounds = eddyWindowBounds(input.now);
  const window = (used: number, limit: number, resetAt: Date): EddyUsageWindow => ({ used, limit, remaining: Math.max(0, limit - used), resetAt: resetAt.toISOString() });
  const result: EddyUsageStatus = {
    featureKey: input.config.featureKey,
    label: input.config.label,
    enabled: input.config.enabled,
    rateLimitsEnabled: input.rateLimitsEnabled ?? eddyRateLimitsEnabled(),
    allowed: true,
    dailyUser: window(input.dailyUserUsed, input.config.dailyUserLimit, bounds.dailyReset),
    dailyCollection: window(input.dailyCollectionUsed, input.config.dailyCollectionLimit, bounds.dailyReset),
    monthlyCollection: window(input.monthlyCollectionUsed, input.config.monthlyCollectionLimit, bounds.monthlyReset)
  };
  if (!result.enabled) return { ...result, allowed: false, reason: "FEATURE_DISABLED" };
  if (!result.rateLimitsEnabled) return result;
  if (result.dailyUser.used >= result.dailyUser.limit) return { ...result, allowed: false, reason: "DAILY_USER" };
  if (result.dailyCollection.used >= result.dailyCollection.limit) return { ...result, allowed: false, reason: "DAILY_COLLECTION" };
  if (result.monthlyCollection.used >= result.monthlyCollection.limit) return { ...result, allowed: false, reason: "MONTHLY_COLLECTION" };
  return result;
}

async function usageCounts(userId: string, collectionId: string, featureKey: EddyFeatureKey, now = new Date(), db: Pick<typeof prisma, "aiRateLimitUsage"> = prisma) {
  const bounds = eddyWindowBounds(now);
  const [dailyUser, dailyCollection, monthlyCollection] = await Promise.all([
    db.aiRateLimitUsage.findUnique({ where: { scopeKey_featureKey_windowType_windowStart: { scopeKey: `user:${userId}`, featureKey, windowType: "DAILY", windowStart: bounds.dailyStart } } }),
    db.aiRateLimitUsage.findUnique({ where: { scopeKey_featureKey_windowType_windowStart: { scopeKey: `collection:${collectionId}`, featureKey, windowType: "DAILY", windowStart: bounds.dailyStart } } }),
    db.aiRateLimitUsage.findUnique({ where: { scopeKey_featureKey_windowType_windowStart: { scopeKey: `collection:${collectionId}`, featureKey, windowType: "MONTHLY", windowStart: bounds.monthlyStart } } })
  ]);
  return { dailyUserUsed: dailyUser?.count ?? 0, dailyCollectionUsed: dailyCollection?.count ?? 0, monthlyCollectionUsed: monthlyCollection?.count ?? 0 };
}

export async function getCurrentAiUsage(input: { userId: string; collectionId: string; featureKey: EddyFeatureKey; now?: Date }) {
  return usageCounts(input.userId, input.collectionId, input.featureKey, input.now);
}

export async function getRemainingEddyUsage(input: { userId: string; collectionId: string; featureKey: EddyFeatureKey; now?: Date }) {
  const config = await getEddyFeatureConfig(input.featureKey, input);
  const counts = await usageCounts(input.userId, input.collectionId, input.featureKey, input.now);
  return evaluateEddyLimits({ config, ...counts, now: input.now });
}

export async function assertEddyRateLimit(input: { userId: string; collectionId: string; featureKey: EddyFeatureKey; now?: Date }) {
  const usage = await getRemainingEddyUsage(input);
  if (!usage.enabled) throw new EddyFeatureDisabledError(usage);
  if (!usage.allowed) throw new EddyRateLimitError(usage);
  return usage;
}

export async function incrementEddyUsage(input: { userId: string; collectionId: string; featureKey: EddyFeatureKey; requestLogId?: string; now?: Date }) {
  const config = await getEddyFeatureConfig(input.featureKey, input);
  if (!config.enabled) {
    const usage = await getRemainingEddyUsage(input);
    throw new EddyFeatureDisabledError(usage);
  }
  if (!eddyRateLimitsEnabled()) return getRemainingEddyUsage(input);
  const bounds = eddyWindowBounds(input.now);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        const counts = await usageCounts(input.userId, input.collectionId, input.featureKey, input.now, tx as never);
        const usage = evaluateEddyLimits({ config, ...counts, now: input.now, rateLimitsEnabled: true });
        if (!usage.allowed) throw new EddyRateLimitError(usage);
        const rows = [
          { scopeKey: `user:${input.userId}`, userId: input.userId, collectionId: input.collectionId, windowType: "DAILY" as const, windowStart: bounds.dailyStart },
          { scopeKey: `collection:${input.collectionId}`, userId: null, collectionId: input.collectionId, windowType: "DAILY" as const, windowStart: bounds.dailyStart },
          { scopeKey: `collection:${input.collectionId}`, userId: null, collectionId: input.collectionId, windowType: "MONTHLY" as const, windowStart: bounds.monthlyStart }
        ];
        for (const row of rows) {
          await tx.aiRateLimitUsage.upsert({
            where: { scopeKey_featureKey_windowType_windowStart: { scopeKey: row.scopeKey, featureKey: input.featureKey, windowType: row.windowType, windowStart: row.windowStart } },
            create: { ...row, featureKey: input.featureKey, count: 1 },
            update: { count: { increment: 1 } }
          });
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return getRemainingEddyUsage(input);
    } catch (error) {
      if (error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Eddy usage could not be reserved.");
}

export async function getEddyUsageOverview(input: { userId: string; collectionId: string }) {
  return Promise.all((Object.keys(eddyFeatures) as EddyFeatureKey[]).map((featureKey) => getRemainingEddyUsage({ ...input, featureKey })));
}

export function formatRateLimitError(usage: EddyUsageStatus) {
  if (usage.reason === "FEATURE_DISABLED") return `${usage.label} are currently disabled.`;
  if (usage.reason === "MONTHLY_COLLECTION") return `Eddy has reached this month's collection limit for ${usage.label.toLowerCase()}. Try again next month.`;
  if (usage.reason === "DAILY_COLLECTION") return `Eddy has reached today's collection limit for ${usage.label.toLowerCase()}. Try again tomorrow.`;
  return `Eddy has reached today's limit for ${usage.label.toLowerCase()}. Try again tomorrow.`;
}
