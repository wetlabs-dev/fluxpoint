import { parseLightChannels, valuesForPoint } from "@/domains/lighting/capabilities";
import { deriveChannelIntensity, sampleLightingSchedule } from "@/domains/lighting/light-load";

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

export function LightingSchedulePreview({ points, profile, rampMinutes }: { points: PreviewPoint[]; profile: PreviewProfile; rampMinutes?: number | null }) {
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
    const color = colorForValues(values, profile);
    return { point, minute: minutes(point.timeOfDay), intensity, color };
  });
  const samples = sampleLightingSchedule(points, profile, rampMinutes, 5);
  const gradientStops = samples.map((sample) => ({
    offset: Math.min(100, Math.max(0, sample.minute / 1440 * 100)),
    color: colorForValues(sample.values, profile),
    opacity: sample.intensity <= 0.005 ? 0.08 : Math.min(0.4, 0.12 + sample.intensity * 0.26)
  }));
  const linePath = samples.length ? samples.map((sample, index) => `${index ? "L" : "M"} ${xForMinute(sample.minute)} ${yFor(sample.intensity * 100)}`).join(" ") : "";
  const areaPath = linePath ? `${linePath} L ${xForMinute(1440)} ${plotBottom} L ${xForMinute(0)} ${plotBottom} Z` : "";
  const labelCandidates = derived.map((entry) => ({ ...entry, x: xForMinute(entry.minute) }));
  const labels = labelCandidates.reduce<typeof labelCandidates>((selected, entry) => selected.length === 0 || entry.x - selected.at(-1)!.x >= 52 ? [...selected, entry] : selected, []);
  const gradientKey = `${ordered.map((point) => `${point.timeOfDay}-${JSON.stringify(valuesForPoint(point))}`).join("-")}-${rampMinutes ?? "legacy"}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 42) || "default";
  const lineGradientId = `lighting-line-${gradientKey}`;
  const areaGradientId = `lighting-area-${gradientKey}`;

  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label="Lighting schedule preview over a continuous 24-hour loop">
        <defs>
          <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
            {gradientStops.map((entry, index) => <stop key={index} offset={`${entry.offset}%`} stopColor={entry.color} />)}
          </linearGradient>
          <linearGradient id={areaGradientId} x1="0" y1="0" x2="1" y2="0">
            {gradientStops.map((entry, index) => <stop key={index} offset={`${entry.offset}%`} stopColor={entry.color} stopOpacity={entry.opacity} />)}
          </linearGradient>
        </defs>
        <line x1={insetX} y1={plotBottom} x2={width - insetX} y2={plotBottom} stroke="currentColor" strokeOpacity="0.18" />
        <line x1={insetX} y1={insetTop} x2={insetX} y2={plotBottom} stroke="currentColor" strokeOpacity="0.18" />
        {areaPath ? <path d={areaPath} fill={`url(#${areaGradientId})`} /> : null}
        {linePath ? <path d={linePath} fill="none" stroke={`url(#${lineGradientId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
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

function colorForValues(values: Record<string, number>, profile: PreviewProfile) {
  const intensity = deriveChannelIntensity(values, profile);
  if (intensity <= 0.005) return "#05080a";
  const power = Number(values.power ?? 0);
  const white = Math.max(0, Number(values.white ?? values.intensity ?? (power > 0 ? 100 : 0)));
  const red = Math.max(0, Number(values.red ?? 0));
  const green = Math.max(0, Number(values.green ?? 0));
  const blue = Math.max(0, Number(values.blue ?? 0));
  const hasRgb = red > 0 || green > 0 || blue > 0;
  if (!hasRgb) {
    const level = Math.round(Math.min(255, 20 + Math.max(white, intensity * 100) * 2.25));
    return `rgb(${level},${Math.round(level * 0.96)},${Math.round(level * 0.82)})`;
  }
  const brightness = 0.24 + intensity * 0.76;
  const desaturate = Math.min(0.68, white / 150);
  const toChannel = (value: number) => {
    const rgb = value * 2.55;
    const mixed = rgb * (1 - desaturate) + 255 * desaturate;
    return Math.round(Math.min(255, mixed * brightness));
  };
  return `rgb(${toChannel(red)},${toChannel(green)},${toChannel(blue)})`;
}
