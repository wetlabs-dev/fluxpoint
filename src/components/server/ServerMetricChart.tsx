export function ServerMetricChart({ label, value, detail, points, suffix = "" }: { label: string; value: string; detail: string; points: number[]; suffix?: string }) {
  const normalized = points.length > 1 ? points : [points[0] || 0, points[0] || 0];
  const max = Math.max(...normalized, 1);
  const min = Math.min(...normalized, 0);
  const span = Math.max(1, max - min);
  const path = normalized.map((point, index) => {
    const x = normalized.length === 1 ? 0 : index / (normalized.length - 1) * 300;
    const y = 92 - ((point - min) / span) * 72;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div className="overflow-hidden rounded-lg border border-emerald-900/30 bg-[#07160f] p-4 text-emerald-50 shadow-soft">
      <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{label}</div><div className="mt-1 text-xs text-emerald-100/65">{detail}</div></div><div className="font-mono text-lg font-semibold">{value}{suffix}</div></div>
      <svg viewBox="0 0 300 105" className="mt-3 h-28 w-full" role="img" aria-label={`${label} recent history`} preserveAspectRatio="none">
        {[20, 56, 92].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgba(167,243,208,.12)" />)}
        <path d={`${path} L300,105 L0,105 Z`} fill="rgba(110,231,183,.12)" />
        <path d={path} fill="none" stroke="#9fca7b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
