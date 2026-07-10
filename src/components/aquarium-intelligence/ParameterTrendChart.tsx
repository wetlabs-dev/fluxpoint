type Point = { measuredAt?: string; value?: number };

export function ParameterTrendChart({ evidence, unit }: { evidence: unknown; unit: string }) {
  const record = evidence && typeof evidence === "object" ? evidence as { observations?: Point[]; targetMin?: number | null; targetMax?: number | null; waterChangeMarkers?: unknown[] } : {};
  const observations = Array.isArray(record.observations) ? record.observations.filter((point) => typeof point.value === "number") : [];
  if (observations.length < 2) return <div className="mt-3 rounded-md bg-muted/45 p-3 text-xs text-muted-foreground">Not enough points for a sparkline.</div>;
  const values = observations.map((point) => Number(point.value));
  const targetValues = [record.targetMin, record.targetMax].filter((value): value is number => typeof value === "number");
  const min = Math.min(...values, ...targetValues);
  const max = Math.max(...values, ...targetValues);
  const span = Math.max(1, max - min);
  const width = 220;
  const height = 56;
  const xFor = (index: number) => observations.length === 1 ? 0 : index / (observations.length - 1) * width;
  const yFor = (value: number) => height - ((value - min) / span) * height;
  const path = observations.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index).toFixed(1)} ${yFor(Number(point.value)).toFixed(1)}`).join(" ");
  return (
    <div className="mt-3 rounded-md bg-muted/35 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Parameter trend chart in ${unit}`} className="h-16 w-full overflow-visible">
        {typeof record.targetMin === "number" ? <line x1="0" x2={width} y1={yFor(record.targetMin)} y2={yFor(record.targetMin)} className="stroke-emerald-500/60" strokeDasharray="4 4" /> : null}
        {typeof record.targetMax === "number" ? <line x1="0" x2={width} y1={yFor(record.targetMax)} y2={yFor(record.targetMax)} className="stroke-amber-500/60" strokeDasharray="4 4" /> : null}
        <path d={path} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {observations.map((point, index) => <circle key={`${point.measuredAt}-${index}`} cx={xFor(index)} cy={yFor(Number(point.value))} r="2.4" className="fill-primary" />)}
      </svg>
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{observations.length} plotted points</span>
        {record.waterChangeMarkers?.length ? <span>{record.waterChangeMarkers.length} water-change marker{record.waterChangeMarkers.length === 1 ? "" : "s"} in window</span> : null}
      </div>
    </div>
  );
}
