import Link from "next/link";
import { Droplets, MapPin, Thermometer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { coverGradient, parseCoverStyle } from "@/lib/design/cover-card";
import { formatReading } from "@/lib/format/readings";
import { buildLocationPath } from "@/lib/format/location";
import { habitatsForSalinity, salinityRangeForLegacy } from "@/domains/species/habitat";

type AquariumCardProps = {
  aquarium: {
    id: string;
    name: string;
    generatedName: string | null;
    salinity: string;
    targetSalinityMinPpt: number | null;
    targetSalinityMaxPpt: number | null;
    aquariumType: string;
    volumeGallons: number | null;
    volumeUnit?: "GALLON" | "LITER";
    location: string | null;
    structuredLocation?: { name: string; parent?: any } | null;
    coverCardStyle: unknown;
    coverMediaAsset?: { url: string; thumbnailUrl: string | null; moderationStatus: string; hiddenAt: Date | null } | null;
    readings?: { parameter: string; value: number; unit: string }[];
    healthConditions?: { id: string; severity: string; status: string }[];
  };
};

export function AquariumCard({ aquarium }: AquariumCardProps) {
  const style = parseCoverStyle(aquarium.coverCardStyle);
  const cover = aquarium.coverMediaAsset?.moderationStatus === "APPROVED" && !aquarium.coverMediaAsset.hiddenAt ? aquarium.coverMediaAsset : null;
  const legacyRange = salinityRangeForLegacy(aquarium.salinity as "FRESHWATER" | "BRACKISH" | "MARINE");
  const habitats = habitatsForSalinity(aquarium.targetSalinityMinPpt ?? legacyRange.min, aquarium.targetSalinityMaxPpt ?? legacyRange.max);
  return (
    <Link href={`/aquariums/${aquarium.id}`}>
      <Card className="group h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_-28px_rgb(9_46_53_/_0.55)]">
        <div className="waterline relative min-h-44 overflow-hidden p-5 text-white" style={{ background: coverGradient(style) }}>
          {cover ? <img src={cover.thumbnailUrl || cover.url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : null}
          {cover ? <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-slate-950/25" /> : null}
          <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">{habitats.map((habitat) => <Badge key={habitat} className="border-white/30 bg-white/18 text-white">{habitat.toLowerCase()}</Badge>)}<Badge className="border-white/30 bg-white/18 text-white">{aquarium.aquariumType.toLowerCase().replace("_", "-")}</Badge></div>
            <Droplets className="h-5 w-5 opacity-75" aria-hidden="true" />
          </div>
          <div className="mt-12">
            <div className="font-display text-4xl font-normal leading-none tracking-normal">{aquarium.generatedName ?? aquarium.name}</div>
            <div className="mt-1 font-sans text-sm text-white/78">{style.mood}</div>
          </div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <div className="font-semibold text-primary">{aquarium.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">{style.motif}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-muted/60 p-3">
              <div className="text-muted-foreground">Volume</div>
              <div className="font-mono font-semibold">{aquarium.volumeGallons ?? "?"} {aquarium.volumeUnit === "LITER" ? "L" : "gal"}</div>
            </div>
            <div className="rounded-md bg-muted/60 p-3">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Location
              </div>
              <div className="truncate font-semibold">{aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation) : aquarium.location ?? "Unplaced"}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {aquarium.healthConditions?.length ? <Badge className="bg-rose-600 text-white">{aquarium.healthConditions.length} high / critical condition{aquarium.healthConditions.length === 1 ? "" : "s"}</Badge> : null}
            {(aquarium.readings ?? []).slice(0, 3).map((reading) => (
              <Badge key={reading.parameter} className="gap-1 bg-sand/30 font-mono text-primary">
                <Thermometer className="h-3 w-3" aria-hidden="true" />
                {reading.parameter.toLowerCase()}: {formatReading(reading.parameter, reading.value, reading.unit)}
              </Badge>
            ))}
          </div>
        </div>
      </Card>
    </Link>
  );
}
