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
  rampMinutes?: number;
};

type PreviewProfile = {
  channels: unknown;
  mode?: string;
} | null;

export function LightingSchedulePreview({ points, profile }: { points: PreviewPoint[]; profile: PreviewProfile }) {
  const channels = parseLightChannels(profile?.channels);
  const ordered = points.slice().sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
  const width = 520;
  const height = 160;
  const inset = 22;
  const minutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
  const xForMinute = (minute: number) => inset + (minute / 1440) * (width - inset * 2);
  const yFor = (value: number) => height - inset - (value / 100) * (height - inset * 2);
  const derived = ordered.map((point) => {
    const values = valuesForPoint(point);
    const normalized = channels.map((channel) => channel.max <= 1 ? Number(values[channel.key] ?? 0) * 100 : Number(values[channel.key] ?? 0));
    // A fixture's visible peak is best represented by its strongest active channel; white also pulls the rendered hue toward neutral.
    const intensity = Math.max(0, ...normalized);
    const r = Number(values.red ?? 0), g = Number(values.green ?? 0), b = Number(values.blue ?? 0), white = Number(values.white ?? values.intensity ?? 0);
    const mix = (value: number) => Math.round(Math.min(255, value * 2.55 + white * 1.35));
    const color = (r || g || b) ? `rgb(${mix(r)},${mix(g)},${mix(b)})` : "#f3d37b";
    return { point, minute: minutes(point.timeOfDay), intensity, color };
  });
  const lineParts: string[] = [];
  derived.forEach((entry, index) => {
    const x = xForMinute(entry.minute), y = yFor(entry.intensity);
    if (!index) { lineParts.push(`M ${x} ${y}`); return; }
    const previous = derived[index - 1];
    const ramp = profile?.mode === "ON_OFF" ? 0 : Math.max(0, entry.point.rampMinutes ?? 0);
    const rampX = xForMinute(Math.max(previous.minute, entry.minute - ramp));
    lineParts.push(`L ${rampX} ${yFor(previous.intensity)}`, `L ${x} ${y}`);
  });
  const linePath = lineParts.join(" ");
  const areaPath = derived.length ? `${linePath} L ${xForMinute(derived.at(-1)!.minute)} ${height - inset} L ${xForMinute(derived[0].minute)} ${height - inset} Z` : "";

  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Lighting schedule preview">
        <defs>
          <linearGradient id="lighting-line" x1="0" y1="0" x2="1" y2="0">{derived.map((entry, index) => <stop key={index} offset={`${derived.length > 1 ? index / (derived.length - 1) * 100 : 0}%`} stopColor={entry.color} />)}</linearGradient>
          <linearGradient id="lighting-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={derived[Math.floor(derived.length / 2)]?.color ?? "#7dd3fc"} stopOpacity="0.38" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0" /></linearGradient>
        </defs>
        <line x1={inset} y1={height - inset} x2={width - inset} y2={height - inset} stroke="currentColor" strokeOpacity="0.18" />
        <line x1={inset} y1={inset} x2={inset} y2={height - inset} stroke="currentColor" strokeOpacity="0.18" />
        {areaPath ? <path d={areaPath} fill="url(#lighting-area)" /> : null}
        {linePath ? <path d={linePath} fill="none" stroke="url(#lighting-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {ordered.map((point, index) => (
          <text key={`${point.timeOfDay}-${index}`} x={xForMinute(minutes(point.timeOfDay))} y={height - 4} textAnchor="middle" className="fill-muted-foreground text-[11px] font-mono">
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
