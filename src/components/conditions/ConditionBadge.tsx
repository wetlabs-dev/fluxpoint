import { Badge } from "@/components/ui/badge";
import { conditionLabel } from "@/domains/conditions/condition-catalog";

export function ConditionBadge({ value, kind = "status" }: { value: string; kind?: "status" | "severity" | "category" }) {
  const style = kind === "severity"
    ? value === "CRITICAL" ? "bg-rose-600 text-white" : value === "HIGH" ? "bg-orange-500 text-white" : value === "MODERATE" ? "bg-amber-200 text-amber-950 dark:bg-amber-800 dark:text-amber-50" : ""
    : value === "WORSENING" ? "bg-rose-100 text-rose-950 dark:bg-rose-900/40 dark:text-rose-100" : value === "RESOLVED" ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-100" : value === "TREATING" ? "bg-sky-100 text-sky-950 dark:bg-sky-900/40 dark:text-sky-100" : "";
  return <Badge className={style}>{conditionLabel(value)}</Badge>;
}
