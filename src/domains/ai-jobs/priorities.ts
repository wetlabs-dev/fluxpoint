export const AI_JOB_PRIORITIES = {
  IMMEDIATE: 10,
  HIGH: 25,
  NORMAL: 100,
  LOW: 200,
  MAINTENANCE: 500
} as const;

export type AiJobPriorityLabel = keyof typeof AI_JOB_PRIORITIES;

export function aiJobPriorityLabel(priority: number): AiJobPriorityLabel | `CUSTOM (${number})` {
  const match = Object.entries(AI_JOB_PRIORITIES).find(([, value]) => value === priority);
  return match ? match[0] as AiJobPriorityLabel : `CUSTOM (${priority})`;
}

export function parseAiJobPriority(value: unknown): number | null {
  if (typeof value !== "string" || !(value in AI_JOB_PRIORITIES)) return null;
  return AI_JOB_PRIORITIES[value as AiJobPriorityLabel];
}
