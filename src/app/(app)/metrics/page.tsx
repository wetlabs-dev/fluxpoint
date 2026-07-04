import { Activity, DatabaseZap, Gauge, KeyRound, LineChart } from "lucide-react";
import { format } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureCollectionMetricDefinitions, metricsBackendStatus } from "@/domains/metrics/metrics-service";
import { grafanaHealth, prometheusHealth } from "@/domains/metrics/grafana-service";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await ensureCollectionMetricDefinitions(collection.id);
  const [status, prometheus, grafana, definitions, tokens, logs, dashboards] = await Promise.all([
    metricsBackendStatus(),
    prometheusHealth(),
    grafanaHealth(),
    prisma.metricDefinition.findMany({ where: { collectionId: collection.id }, orderBy: { key: "asc" } }),
    prisma.metricIngestionToken.findMany({ where: { collectionId: collection.id, revokedAt: null }, include: { aquarium: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.metricSyncLog.findMany({ where: { collectionId: collection.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.grafanaManagedDashboard.findMany({ where: { collectionId: collection.id }, include: { aquarium: true }, orderBy: { updatedAt: "desc" }, take: 12 })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Metrics" eyebrow="Observability" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={Activity} label="Backend" value={status.enabled ? status.backend : "disabled"} note={`Graph backend: ${status.graphBackend}. Embed mode: ${status.embedMode}.`} muted={!status.enabled} />
        <StatusCard icon={Gauge} label="Prometheus" value={prometheus.ok ? "ready" : "attention"} note={prometheus.message} muted={!prometheus.ok} />
        <StatusCard icon={LineChart} label="Grafana" value={grafana.ok ? "ready" : "not embedded"} note={grafana.message} muted={!grafana.ok} />
        <StatusCard icon={DatabaseZap} label="Latest Reading" value={status.latestReading ? "available" : "none yet"} note={status.latestReading ? format(status.latestReading.measuredAt, "MMM d h:mm a") : "Ingest sensor data or log readings to populate metrics."} muted={!status.latestReading} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader><CardTitle>Metric Definitions</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr><th className="py-2">Name</th><th>Key</th><th>Unit</th><th>Prometheus</th><th>Default bounds</th></tr>
              </thead>
              <tbody>
                {definitions.map((definition) => (
                  <tr key={definition.id} className="border-t border-border">
                    <td className="py-3 font-semibold text-primary">{definition.displayName}</td>
                    <td className="font-mono text-xs">{definition.key}</td>
                    <td className="font-mono text-xs">{definition.unit}</td>
                    <td><code className="rounded bg-muted px-2 py-1 text-xs">{definition.prometheusName}</code></td>
                    <td className="font-mono text-xs text-muted-foreground">{definition.defaultMin ?? "none"} / {definition.defaultMax ?? "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-water" /> Ingestion Tokens</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {tokens.map((token) => (
              <div key={token.id} className="rounded-md border border-border bg-background/55 p-3">
                <div className="font-semibold text-primary">{token.name}</div>
                <div className="text-sm text-muted-foreground">{token.aquarium?.name ?? "Collection-wide"}</div>
                <div className="font-mono text-xs text-muted-foreground">last used {token.lastUsedAt ? format(token.lastUsedAt, "MMM d h:mm a") : "never"}</div>
              </div>
            ))}
            {!tokens.length ? <p className="text-sm text-muted-foreground">Create aquarium-scoped tokens from an aquarium Metrics tab.</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Managed Dashboards</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboards.map((dashboard) => (
              <div key={dashboard.id} className="rounded-md border border-border bg-background/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-primary">{dashboard.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{dashboard.uid}</div>
                  </div>
                  <Badge>{dashboard.status}</Badge>
                </div>
                {dashboard.lastError ? <p className="mt-2 text-sm text-muted-foreground">{dashboard.lastError}</p> : null}
              </div>
            ))}
            {!dashboards.length ? <p className="text-sm text-muted-foreground">Aquarium dashboards appear after a tank is created or synced.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent Sync Logs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-md border border-border bg-background/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-primary">{log.action}</div>
                  <Badge>{log.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{log.message ?? "No message."}</p>
                <div className="mt-2 font-mono text-xs text-muted-foreground">{format(log.createdAt, "MMM d h:mm a")}</div>
              </div>
            ))}
            {!logs.length ? <p className="text-sm text-muted-foreground">No metrics sync activity yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  note,
  muted = false
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background/65 p-4">
      <Icon className={muted ? "h-5 w-5 text-muted-foreground" : "h-5 w-5 text-water"} />
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono font-semibold text-primary">{value}</div>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
