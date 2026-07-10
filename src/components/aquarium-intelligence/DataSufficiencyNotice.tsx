type Coverage = { missing?: string[]; latestWaterTestAgeDays?: number | null; readingCount30d?: number; sensorReadingCount7d?: number; stockingAssessmentStale?: boolean };

export function DataSufficiencyNotice({ coverage }: { coverage: Coverage | null }) {
  if (!coverage) return null;
  const issues = [...(coverage.missing ?? [])];
  if (coverage.stockingAssessmentStale) issues.push("stale or missing Stocking Pressure");
  if (!issues.length) return null;
  return (
    <div className="rounded-md border border-amber-300/50 bg-amber-100/45 p-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/25 dark:text-amber-100">
      <div className="font-semibold">Assessment confidence is limited</div>
      <p className="mt-1">Missing or stale context: {issues.join(", ")}. Fluxpoint lowers confidence instead of treating missing data as healthy.</p>
    </div>
  );
}
