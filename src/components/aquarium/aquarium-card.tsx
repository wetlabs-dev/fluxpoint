import Link from "next/link";
import type { ReactNode } from "react";
import { Droplets, HeartPulse, MapPin, Thermometer, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ParallaxCoverImage } from "@/components/aquarium/ParallaxCoverImage";
import { coverGradient, parseCoverStyle } from "@/lib/design/cover-card";
import { formatReading } from "@/lib/format/readings";
import { buildLocationPath } from "@/lib/format/location";
import { habitatsForSalinity, salinityRangeForLegacy } from "@/domains/species/habitat";
import { mediaDeliveryUrl } from "@/domains/media/media-urls";
import { formatInhabitantBreakdown, formatQuantity, summarizeInhabitantCounts } from "@/domains/aquariums/inhabitant-counts";

type AquariumCardProps = {
  aquarium: {
    id: string;
    name: string;
    description: string | null;
    salinity: string;
    targetSalinityMinPpt: number | null;
    targetSalinityMaxPpt: number | null;
    aquariumType: string;
    volumeGallons: number | null;
    volumeUnit?: "GALLON" | "LITER";
    location: string | null;
    structuredLocation?: { name: string; parent?: any } | null;
    coverCardStyle: unknown;
    coverMediaAsset?: { id?: string; url: string; thumbnailUrl: string | null; moderationStatus: string; hiddenAt: Date | null } | null;
    items?: { itemType: string; quantity: number; status: string }[];
    readings?: { parameter: string; value: number; unit: string }[];
    healthConditions?: { id: string; severity: string; status: string }[];
    planSummary?: { id: string; title: string; planType: string; percent: number; requiredRemaining: number; targetCompletionDate: Date | null; status: string } | null;
  };
};

export function AquariumCard({ aquarium }: AquariumCardProps) {
  const style = parseCoverStyle(aquarium.coverCardStyle);
  const cover = aquarium.coverMediaAsset?.moderationStatus === "APPROVED" && !aquarium.coverMediaAsset.hiddenAt ? aquarium.coverMediaAsset : null;
  const legacyRange = salinityRangeForLegacy(aquarium.salinity as "FRESHWATER" | "BRACKISH" | "MARINE");
  const habitats = habitatsForSalinity(aquarium.targetSalinityMinPpt ?? legacyRange.min, aquarium.targetSalinityMaxPpt ?? legacyRange.max);
  const meaningfulMood = style.mood?.trim().toLowerCase() !== "new aquarium plan" ? style.mood?.trim() : "";
  const naturalSummary = `${habitats.join(" / ") || aquarium.salinity.toLowerCase()} ${aquarium.aquariumType.toLowerCase().replaceAll("_", " ")}`;
  const subtitle = meaningfulMood || aquarium.description?.trim() || naturalSummary;
  const inhabitantCounts = summarizeInhabitantCounts(aquarium.items ?? []);
  const openConditionCount = aquarium.healthConditions?.length ?? 0;
  const locationLabel = aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation) : aquarium.location ?? "Unplaced";
  const planning = aquarium.planSummary;
  return (
    <Link href={`/aquariums/${aquarium.id}`} className="block h-full">
      <Card className="group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_-28px_rgb(9_46_53_/_0.55)]">
        <div className="waterline relative h-44 overflow-hidden p-5 text-white" style={{ background: coverGradient(style) }}>
          {cover ? <ParallaxCoverImage src={mediaDeliveryUrl(cover.thumbnailUrl || cover.url, cover.id)} alt="" className="absolute inset-0 h-full w-full" /> : null}
          {cover ? <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/18 to-slate-950/15" /> : null}
          <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">{habitats.map((habitat) => <Badge key={habitat} className="border-white/30 bg-white/18 text-white">{habitat.toLowerCase()}</Badge>)}<Badge className="border-white/30 bg-white/18 text-white">{aquarium.aquariumType.toLowerCase().replace("_", "-")}</Badge></div>
            <Droplets className="h-5 w-5 opacity-75" aria-hidden="true" />
          </div>
          <div className="mt-12">
            <div className="font-display text-4xl font-normal leading-none tracking-normal">{aquarium.name}</div>
            <div className="mt-1 font-sans text-sm text-white/78">{subtitle}</div>
          </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <SpecTile label="Volume" value={`${aquarium.volumeGallons ?? "?"} ${aquarium.volumeUnit === "LITER" ? "L" : "gal"}`} />
            <SpecTile label="Location" value={locationLabel} icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />} />
            <SpecTile label="Inhabitants" value={formatQuantity(inhabitantCounts.total)} detail={formatInhabitantBreakdown(inhabitantCounts)} icon={<UsersRound className="h-3.5 w-3.5" aria-hidden="true" />} />
            <SpecTile
              label="Open conditions"
              value={String(openConditionCount)}
              icon={<HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />}
              attention={openConditionCount > 0}
            />
          </div>
          {(aquarium.readings ?? []).length ? (
            <div className="flex flex-wrap gap-2">
              {(aquarium.readings ?? []).slice(0, 3).map((reading) => (
                <Badge key={reading.parameter} className="gap-1 bg-sand/30 font-mono text-primary">
                  <Thermometer className="h-3 w-3" aria-hidden="true" />
                  {reading.parameter.toLowerCase()}: {formatReading(reading.parameter, reading.value, reading.unit)}
                </Badge>
              ))}
            </div>
          ) : null}
          {planning ? (
            <div className="rounded-md border border-water/25 bg-water/10 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-primary">{aquarium.salinity && aquarium.planSummary?.planType === "INITIAL_SETUP" ? "Continue setup" : "Revision in progress"}</span>
                <span className="font-mono text-xs text-muted-foreground">{planning.percent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/70"><div className="h-full bg-water" style={{ width: `${planning.percent}%` }} /></div>
              <div className="mt-1 text-xs text-muted-foreground">{planning.requiredRemaining} required remaining</div>
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}

function SpecTile({ label, value, detail, icon, attention = false }: { label: string; value: string; detail?: string; icon?: ReactNode; attention?: boolean }) {
  return (
    <div className={`rounded-md p-3 ${attention ? "bg-rose-500/10 text-rose-700 dark:text-rose-200" : "bg-muted/60"}`}>
      <div className={`flex items-center gap-1 ${attention ? "text-rose-700/80 dark:text-rose-200/80" : "text-muted-foreground"}`}>
        {icon}
        {label}
      </div>
      <div className="truncate font-mono font-semibold">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-snug text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
