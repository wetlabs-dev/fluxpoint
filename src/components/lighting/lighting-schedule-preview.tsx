import { parseLightChannels, valuesForPoint } from "@/domains/lighting/capabilities";
import { buildLightingSegments, deriveChannelIntensity, intensityAtMinute } from "@/domains/lighting/light-load";

type PreviewPoint = {
  id?: string;
  timeOfDay: string;
  white: number;
  red: number;
  green: number;
  blue: number;
  warmWhite: number | null;
  intensity: number | null;
  values: unknown;
  rampMinutes?: number;
};

type PreviewProfile = {
  channels: unknown;
  mode?: string;
} | null;

export function LightingSchedulePreview({ points, profile }: { points: PreviewPoint[]; profile: PreviewProfile }) {
  const channels = parseLightChannels(profile?.channels);
  const ordered = points.slice().sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
  const width = 600;
  const height = 190;
  const insetX = 30;
  const insetTop = 18;
  const insetBottom = 48;
  const minutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
  const xForMinute = (minute: number) => insetX + (minute / 1440) * (width - insetX * 2);
  const plotBottom = height - insetBottom;
  const yFor = (value: number) => plotBottom - (value / 100) * (plotBottom - insetTop);
  const derived = ordered.map((point) => {
    const values = valuesForPoint(point);
    const intensity = deriveChannelIntensity(values, profile) * 100;
    const r = Number(values.red ?? 0), g = Number(values.green ?? 0), b = Number(values.blue ?? 0), white = Number(values.white ?? values.intensity ?? 0);
    const mix = (value: number) => Math.round(Math.min(255, value * 2.55 + white * 1.35));
    const color = (r || g || b) ? `rgb(${mix(r)},${mix(g)},${mix(b)})` : "#f3d37b";
    return { point, minute: minutes(point.timeOfDay), intensity, color };
  });
  const segments = buildLightingSegments(points, profile);
  const boundaryMinutes = segments.flatMap((segment) => [segment.startMinute, segment.endMinute]).map((minute) => ((minute % 1440) + 1440) % 1440);
  const samples = [...new Set([0, 1440, ...Array.from({ length: 97 }, (_, index) => index * 15), ...boundaryMinutes.flatMap((minute) => [Math.max(0, minute - 0.01), minute, Math.min(1440, minute + 0.01)])])].sort((a, b) => a - b);
  const linePath = segments.length ? samples.map((minute, index) => `${index ? "L" : "M"} ${xForMinute(minute)} ${yFor(intensityAtMinute(segments, minute) * 100)}`).join(" ") : "";
  const areaPath = linePath ? `${linePath} L ${xForMinute(1440)} ${plotBottom} L ${xForMinute(0)} ${plotBottom} Z` : "";
  const labelCandidates = derived.map((entry) => ({ ...entry, x: xForMinute(entry.minute) }));
  const labels = labelCandidates.reduce<typeof labelCandidates>((selected, entry) => selected.length === 0 || entry.x - selected.at(-1)!.x >= 52 ? [...selected, entry] : selected, []);

  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Lighting schedule preview over a continuous 24-hour loop">
        <defs>
          <linearGradient id="lighting-line" x1="0" y1="0" x2="1" y2="0">{derived.map((entry, index) => <stop key={index} offset={`${derived.length > 1 ? index / (derived.length - 1) * 100 : 0}%`} stopColor={entry.color} />)}</linearGradient>
          <linearGradient id="lighting-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={derived[Math.floor(derived.length / 2)]?.color ?? "#7dd3fc"} stopOpacity="0.38" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0" /></linearGradient>
        </defs>
        <line x1={insetX} y1={plotBottom} x2={width - insetX} y2={plotBottom} stroke="currentColor" strokeOpacity="0.18" />
        <line x1={insetX} y1={insetTop} x2={insetX} y2={plotBottom} stroke="currentColor" strokeOpacity="0.18" />
        {areaPath ? <path d={areaPath} fill="url(#lighting-area)" /> : null}
        {linePath ? <path d={linePath} fill="none" stroke="url(#lighting-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {labels.map((entry, index) => (
          <text key={`${entry.point.timeOfDay}-${index}`} x={entry.x} y={plotBottom + 14} textAnchor="end" transform={`rotate(-40 ${entry.x} ${plotBottom + 14})`} className="fill-muted-foreground text-[10px] font-mono">
            {entry.point.timeOfDay.replace(/^0/, "")}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        {channels.map((channel) => (
          <span key={channel.key} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: channel.color }} />
            {channel.label}
          </span>
        ))}
      </div>
    </div>
  );
}
