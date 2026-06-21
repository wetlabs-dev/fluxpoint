import type { RegionalSpeciesStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { regionalStatusLabels } from "@/domains/species/regional-status";

export function RegionalStatusBadge({ status }: { status: RegionalSpeciesStatus }) {
  const tone = status === "PROHIBITED" ? "border-red-600 bg-red-600 text-white" : status === "RESTRICTED" ? "border-red-500/60 bg-red-500/15 text-red-700 dark:text-red-200" : status === "INVASIVE" ? "border-orange-500/60 bg-orange-500/15 text-orange-800 dark:text-orange-200" : ["WATCHLIST", "ESTABLISHED_NON_NATIVE"].includes(status) ? "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200" : status === "NOT_LISTED" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "";
  return <Badge className={tone}>{regionalStatusLabels[status]}</Badge>;
}
