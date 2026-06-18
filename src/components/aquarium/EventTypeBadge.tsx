import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const eventStyles: Record<string, string> = {
  NOTE: "bg-muted text-muted-foreground",
  FEEDING: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-100",
  WATER_CHANGE: "bg-cyan-100 text-cyan-950 dark:bg-cyan-900/35 dark:text-cyan-100",
  TEST_RESULT: "bg-blue-100 text-blue-950 dark:bg-blue-900/35 dark:text-blue-100",
  MAINTENANCE: "bg-amber-100 text-amber-950 dark:bg-amber-900/35 dark:text-amber-100",
  MEDICATION: "bg-rose-100 text-rose-950 dark:bg-rose-900/35 dark:text-rose-100",
  LIVESTOCK_ADDITION: "bg-lime-100 text-lime-950 dark:bg-lime-900/35 dark:text-lime-100",
  LIVESTOCK_LOSS: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
  PLANT_ADDITION: "bg-green-100 text-green-950 dark:bg-green-900/35 dark:text-green-100",
  PLANT_REMOVAL: "bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100",
  EQUIPMENT_MAINTENANCE: "bg-orange-100 text-orange-950 dark:bg-orange-900/35 dark:text-orange-100",
  STOCKING: "bg-lime-100 text-lime-950 dark:bg-lime-900/35 dark:text-lime-100",
  DEATH: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
  SPAWN: "bg-pink-100 text-pink-950 dark:bg-pink-900/35 dark:text-pink-100",
  PHOTO: "bg-violet-100 text-violet-950 dark:bg-violet-900/35 dark:text-violet-100",
  EQUIPMENT_CHANGE: "bg-orange-100 text-orange-950 dark:bg-orange-900/35 dark:text-orange-100",
  TRANSFER: "bg-teal-100 text-teal-950 dark:bg-teal-900/35 dark:text-teal-100"
};

export function EventTypeBadge({ type, className }: { type: string; className?: string }) {
  return <Badge className={cn(eventStyles[type] ?? "bg-muted text-muted-foreground", className)}>{type.replaceAll("_", " ").toLowerCase()}</Badge>;
}
