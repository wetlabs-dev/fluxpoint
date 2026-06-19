import { Droplets, Leaf, Utensils, Waves } from "lucide-react";
import { buildHusbandryBadges, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";

const toneClass: Record<string, string> = {
  good: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
  notice: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100",
  neutral: "border-border bg-muted/45 text-muted-foreground"
};

export function HusbandryBadges({ type, fields }: { type: HusbandrySpeciesType; fields: unknown }) {
  const badges = buildHusbandryBadges(type, fields);
  if (!badges.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge, index) => {
        const Icon = index === 0 ? Leaf : index === 1 ? Droplets : index === 2 ? Utensils : Waves;
        return (
          <span key={`${badge.key}-${badge.label}`} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass[badge.tone] ?? toneClass.neutral}`}>
            <Icon className="h-3.5 w-3.5" />
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}
