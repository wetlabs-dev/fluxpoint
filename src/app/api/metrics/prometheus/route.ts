import { renderPrometheusMetrics } from "@/domains/metrics/metrics-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(await renderPrometheusMetrics(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
