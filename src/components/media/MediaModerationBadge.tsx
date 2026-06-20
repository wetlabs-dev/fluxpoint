import { Badge } from "@/components/ui/badge";

export function MediaModerationBadge({ status, hidden = false }: { status: string; hidden?: boolean }) {
  const label = hidden ? "hidden" : status.toLowerCase();
  return <Badge className={status === "APPROVED" && !hidden ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100" : ""}>{label}</Badge>;
}
