import { runWorker } from "./lib";
import { collectAndPersistServerMetrics } from "../../src/domains/server/server-metrics";
import { syncAquariumDashboards, grafanaHealth, prometheusHealth } from "../../src/domains/metrics/grafana-service";
import { prisma } from "../../src/lib/db/prisma";

runWorker({
  name: "metrics",
  enabledEnv: "ENABLE_METRICS_WORKER",
  intervalMs: Number(process.env.METRICS_WORKER_INTERVAL_MS || 10 * 60 * 1000),
  tick: async () => {
    await collectAndPersistServerMetrics();
    if (process.env.METRICS_ENABLED !== "false") {
      const [prometheus, grafana] = await Promise.all([prometheusHealth(), grafanaHealth()]);
      await prisma.metricSyncLog.create({ data: { action: "CHECK_BACKENDS", status: prometheus.ok && (grafana.ok || process.env.GRAFANA_EMBED_MODE === "native") ? "SUCCEEDED" : "SKIPPED", message: `Prometheus: ${prometheus.message} Grafana: ${grafana.message}` } });
      await syncAquariumDashboards();
    }
  }
});
