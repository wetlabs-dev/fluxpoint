import { parseLightChannels, valuesForPoint } from "@/domains/lighting/capabilities";

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
};

type PreviewProfile = {
  channels: unknown;
} | null;

export function LightingSchedulePreview({ points, profile }: { points: PreviewPoint[]; profile: PreviewProfile }) {
  const channels = parseLightChannels(profile?.channels);
  const ordered = points.slice().sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
  const width = 520;
  const height = 160;
  const inset = 22;
  const xFor = (index: number) => inset + (index / Math.max(ordered.length - 1, 1)) * (width - inset * 2);
  const yFor = (value: number) => height - inset - (value / 100) * (height - inset * 2);

  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Lighting schedule preview">
        <line x1={inset} y1={height - inset} x2={width - inset} y2={height - inset} stroke="currentColor" strokeOpacity="0.18" />
        <line x1={inset} y1={inset} x2={inset} y2={height - inset} stroke="currentColor" strokeOpacity="0.18" />
        {channels.map((channel) => {
          const path = ordered.map((point, index) => {
            const values = valuesForPoint(point);
            const raw = Number(values[channel.key] ?? 0);
            const normalized = channel.max <= 1 ? raw * 100 : raw;
            return `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(normalized).toFixed(1)}`;
          }).join(" ");
          return <path key={channel.key} d={path} fill="none" stroke={channel.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {ordered.map((point, index) => (
          <text key={`${point.timeOfDay}-${index}`} x={xFor(index)} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-[11px] font-mono">
            {point.timeOfDay}
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
