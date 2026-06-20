import { format } from "date-fns";
import type { MetricHistoryPoint } from "@/domains/metrics/prometheus-query";

export function TankMetricChart({
  label,
  unit,
  points,
  minValue,
  maxValue,
  source
}: {
  label: string;
  unit: string;
  points: MetricHistoryPoint[];
  minValue: number | null;
  maxValue: number | null;
  source: "prometheus" | "recent readings";
}) {
  const values = points.map((point) => point.value);
  const domainValues = [...values, ...(minValue === null ? [] : [minValue]), ...(maxValue === null ? [] : [maxValue])];
  const rawMin = Math.min(...domainValues);
  const rawMax = Math.max(...domainValues);
  const padding = Math.max((rawMax - rawMin) * 0.12, Math.abs(rawMax || 1) * 0.03, 0.1);
  const low = rawMin - padding;
  const high = rawMax + padding;
  const span = Math.max(high - low, 0.01);
  const x = (index: number) => points.length < 2 ? 150 : index / (points.length - 1) * 300;
  const y = (value: number) => 102 - ((value - low) / span) * 84;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const latest = points.at(-1);
  const state = latest ? latest.value < (minValue ?? -Infinity) ? "low" : latest.value > (maxValue ?? Infinity) ? "high" : "in range" : "no data";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-primary">{label}</div>
          <div className="mt-1 text-xs text-muted-foreground">7 days · {source}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-semibold">{latest ? `${latest.value} ${unit}` : "—"}</div>
          <div className={`text-xs font-semibold ${state === "in range" ? "text-emerald-600 dark:text-emerald-300" : state === "no data" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}>{state}</div>
        </div>
      </div>
      {points.length ? (
        <svg viewBox="0 0 300 118" className="mt-3 h-40 w-full" role="img" aria-label={`${label} seven day history with target bounds`} preserveAspectRatio="none">
          {[24, 60, 102].map((lineY) => <line key={lineY} x1="0" x2="300" y1={lineY} y2={lineY} stroke="hsl(var(--border))" />)}
          {minValue !== null ? <line x1="0" x2="300" y1={y(minValue)} y2={y(minValue)} stroke="#d97706" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" /> : null}
          {maxValue !== null ? <line x1="0" x2="300" y1={y(maxValue)} y2={y(maxValue)} stroke="#e11d48" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" /> : null}
          <path d={`${path} L300,112 L0,112 Z`} fill="rgb(34 211 238 / .10)" />
          <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : <div className="mt-3 grid h-40 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">No history available yet.</div>}
      <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-xs text-muted-foreground">
        <span>{points[0] ? format(points[0].timestamp, "MMM d") : "No samples"}</span>
        <span>{minValue !== null ? `min ${minValue}` : "no min"} · {maxValue !== null ? `max ${maxValue}` : "no max"}</span>
        <span>{latest ? format(latest.timestamp, "MMM d h:mm a") : ""}</span>
      </div>
    </div>
  );
}
