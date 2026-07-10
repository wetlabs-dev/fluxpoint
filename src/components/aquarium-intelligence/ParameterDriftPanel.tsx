import { ParameterTrendCard } from "@/components/aquarium-intelligence/ParameterTrendCard";

type Analysis = Parameters<typeof ParameterTrendCard>[0]["analysis"];

export function ParameterDriftPanel({ analyses }: { analyses: Analysis[] }) {
  if (!analyses.length) return <p className="text-sm text-muted-foreground">No saved parameter analyses yet. Refresh aquarium intelligence to generate trends.</p>;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{analyses.map((analysis) => <ParameterTrendCard key={`${analysis.metricKey}-${analysis.analysisWindowEnd.toISOString()}`} analysis={analysis} />)}</div>;
}
