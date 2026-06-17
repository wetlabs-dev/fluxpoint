import Link from "next/link";
import { Droplets, MapPin, Thermometer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { coverGradient, parseCoverStyle } from "@/lib/design/cover-card";
import { formatReading } from "@/lib/format/readings";

type AquariumCardProps = {
  aquarium: {
    id: string;
    name: string;
    generatedName: string | null;
    tankType: string;
    volumeGallons: number | null;
    location: string | null;
    coverCardStyle: unknown;
    readings?: { parameter: string; value: number; unit: string }[];
  };
};

export function AquariumCard({ aquarium }: AquariumCardProps) {
  const style = parseCoverStyle(aquarium.coverCardStyle);
  return (
    <Link href={`/aquariums/${aquarium.id}`}>
      <Card className="group h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_-28px_rgb(9_46_53_/_0.55)]">
        <div className="waterline min-h-44 p-5 text-white" style={{ background: coverGradient(style) }}>
          <div className="flex items-start justify-between gap-3">
            <Badge className="border-white/30 bg-white/18 text-white">{aquarium.tankType.toLowerCase()}</Badge>
            <Droplets className="h-5 w-5 opacity-75" aria-hidden="true" />
          </div>
          <div className="mt-12">
            <div className="font-display text-4xl font-normal leading-none tracking-normal">{aquarium.generatedName ?? aquarium.name}</div>
            <div className="mt-1 font-sans text-sm text-white/78">{style.mood}</div>
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
              <div className="font-mono font-semibold">{aquarium.volumeGallons ?? "?"} gal</div>
            </div>
            <div className="rounded-md bg-muted/60 p-3">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Location
              </div>
              <div className="truncate font-semibold">{aquarium.location ?? "Unplaced"}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
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
