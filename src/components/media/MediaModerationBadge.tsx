import { Badge } from "@/components/ui/badge";

export function MediaModerationBadge({ status, hidden = false }: { status: string; hidden?: boolean }) {
  const label = hidden ? "hidden" : status.toLowerCase().replaceAll("_", " ");
  const tone = status === "APPROVED" && !hidden
    ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100"
    : ["CENSORED", "REMOVED", "REJECTED", "FLAGGED"].includes(status)
      ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100"
      : ["NO_AQUARIUM_CONTENT", "UNCERTAIN_AQUARIUM_CONTENT", "MODERATION_FAILED", "ERROR"].includes(status)
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        : "";
  return <Badge className={tone}>{label}</Badge>;
}
