export type MetricHistoryPoint = { timestamp: number; value: number };

type PrometheusRangeResponse = {
  status?: string;
  data?: {
    result?: Array<{ values?: Array<[number, string]> }>;
  };
};

export async function queryAquariumMetricHistory(options: {
  aquariumId: string;
  prometheusName: string;
  hours?: number;
}): Promise<MetricHistoryPoint[] | null> {
  const baseUrl = process.env.PROMETHEUS_URL || "http://prometheus:9090";
  const end = Math.floor(Date.now() / 1000);
  const hours = options.hours ?? 168;
  const start = end - hours * 60 * 60;
  const step = Math.max(300, Math.floor((hours * 60 * 60) / 168));
  const query = `${options.prometheusName}{aquarium_id="${escapePrometheusLabel(options.aquariumId)}"}`;
  const url = new URL("/api/v1/query_range", baseUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("start", String(start));
  url.searchParams.set("end", String(end));
  url.searchParams.set("step", String(step));

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    const payload = await response.json() as PrometheusRangeResponse;
    if (payload.status !== "success") return null;
    const points = payload.data?.result?.flatMap((series) => series.values ?? []) ?? [];
    return points
      .map(([timestamp, rawValue]) => ({ timestamp: timestamp * 1000, value: Number(rawValue) }))
      .filter((point) => Number.isFinite(point.value))
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch {
    return null;
  }
}

function escapePrometheusLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
