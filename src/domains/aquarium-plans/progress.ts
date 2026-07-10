import type { AquariumPlanItemStatus } from "@prisma/client";

export type PlanProgressInput = {
  isRequired: boolean;
  status: AquariumPlanItemStatus;
  weight?: number | null;
};

export type AquariumPlanProgress = {
  requiredTotal: number;
  requiredResolved: number;
  optionalTotal: number;
  optionalResolved: number;
  requiredRemaining: number;
  optionalRemaining: number;
  blockedCount: number;
  readyCount: number;
  failedCount: number;
  percent: number;
  readyToComplete: boolean;
};

const resolvedStatuses = new Set<AquariumPlanItemStatus>(["IMPLEMENTED", "SKIPPED"]);
const excludedStatuses = new Set<AquariumPlanItemStatus>(["CANCELLED"]);

function itemWeight(item: PlanProgressInput) {
  const weight = item.weight ?? 1;
  return Number.isFinite(weight) && weight > 0 ? Math.min(Math.max(Math.round(weight), 1), 3) : 1;
}

export function calculateAquariumPlanProgress(items: PlanProgressInput[]): AquariumPlanProgress {
  let requiredTotal = 0;
  let requiredResolved = 0;
  let optionalTotal = 0;
  let optionalResolved = 0;
  let blockedCount = 0;
  let readyCount = 0;
  let failedCount = 0;

  for (const item of items) {
    if (excludedStatuses.has(item.status)) continue;
    const weight = itemWeight(item);
    const resolved = resolvedStatuses.has(item.status);
    if (item.isRequired) {
      requiredTotal += weight;
      if (resolved) requiredResolved += weight;
    } else {
      optionalTotal += weight;
      if (resolved) optionalResolved += weight;
    }
    if (item.status === "BLOCKED") blockedCount += 1;
    if (item.status === "READY") readyCount += 1;
    if (item.status === "FAILED") failedCount += 1;
  }

  const percent = requiredTotal ? Math.round((requiredResolved / requiredTotal) * 100) : 0;
  return {
    requiredTotal,
    requiredResolved,
    optionalTotal,
    optionalResolved,
    requiredRemaining: Math.max(requiredTotal - requiredResolved, 0),
    optionalRemaining: Math.max(optionalTotal - optionalResolved, 0),
    blockedCount,
    readyCount,
    failedCount,
    percent,
    readyToComplete: requiredTotal > 0 && requiredResolved >= requiredTotal
  };
}

export function planProgressCopy(progress: AquariumPlanProgress) {
  if (!progress.requiredTotal) return "No required changes yet.";
  return `${progress.requiredResolved} of ${progress.requiredTotal} required point${progress.requiredTotal === 1 ? "" : "s"} resolved`;
}
