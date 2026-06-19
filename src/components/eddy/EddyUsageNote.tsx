import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";

export function EddyUsageNote({ usage, compact = false }: { usage?: EddyUsageStatus | null; compact?: boolean }) {
  if (!usage) return null;
  return <p className={`${compact ? "text-xs" : "text-sm"} text-muted-foreground`}>
    {usage.dailyUser.used} of {usage.dailyUser.limit} {usage.label.toLowerCase()} used today · {usage.dailyUser.remaining} remaining
    {!usage.allowed ? ` · ${usage.reason === "FEATURE_DISABLED" ? "Currently disabled" : usage.reason === "MONTHLY_COLLECTION" ? "Resets next month" : "Resets tomorrow"}` : ""}
  </p>;
}
