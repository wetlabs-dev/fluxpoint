import { readdir, stat } from "fs/promises";
import path from "path";
import { Activity, Box, CheckCircle2, Clock3, Database, HardDriveDownload, LineChart, Mail } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { emailProviderStatus } from "@/domains/email/email-service";
import { grafanaHealth, prometheusHealth } from "@/domains/metrics/grafana-service";
import { metricsBackendStatus } from "@/domains/metrics/metrics-service";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { getEddyUsageOverview } from "@/domains/eddy/rate-limits";

export const dynamic = "force-dynamic";

export default async function ServerMaintenancePage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const backupFiles = await getBackupFiles();
  const aiStatus = aiProviderStatus();
  const emailStatus = emailProviderStatus();
  const [eddyUsage, aiLogCount, emailLogCount, metricsStatus, prometheus, grafana, recentMetricLogs, recentAiRequests] = await Promise.all([
    getEddyUsageOverview({ userId: user.id, collectionId: collection.id }),
    prisma.aiRequestLog.count({ where: { collectionId: collection.id, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.emailLog.count({ where: { collectionId: collection.id } }),
    metricsBackendStatus(),
    prometheusHealth(),
    grafanaHealth(),
    prisma.metricSyncLog.findMany({ where: { collectionId: collection.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.aiRequestLog.findMany({ where: { collectionId: collection.id, featureKey: { not: null } }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Server Maintenance" eyebrow="Operations" />
      <Card>
        <CardHeader><CardTitle>Server Health</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HealthCard icon={CheckCircle2} label="App" value="Online" note="This page rendered successfully." />
          <HealthCard icon={Database} label="Database" value="Connected" note="Server maintenance records loaded." />
          <HealthCard icon={EddyIcon} label="Eddy provider" value={`${aiStatus.enabled ? aiStatus.provider : "disabled"}${aiStatus.fallbackActive ? " fallback" : ""}`} note={`${aiLogCount} request(s) in 30 days. Images ${aiStatus.imageEnabled ? "enabled" : "disabled"}; moderation ${aiStatus.moderationEnabled ? "enabled" : "disabled"}. ${aiStatus.configured ? "Provider configured." : "Mock/local fallback; no secrets shown."}`} muted={!aiStatus.enabled || !aiStatus.configured || aiStatus.fallbackActive} />
          <HealthCard icon={Mail} label="Email" value={emailStatus.provider} note={`${emailLogCount} logged email(s). ${emailStatus.configured ? "Delivery provider configured." : "Console/local delivery only."}`} muted={!emailStatus.configured || emailStatus.provider === "console"} />
          <HealthCard icon={Activity} label="Metrics" value={metricsStatus.enabled ? metricsStatus.backend : "Disabled"} note={`Scrape endpoint: /api/metrics/prometheus. Latest reading: ${metricsStatus.latestReading ? metricsStatus.latestReading.measuredAt.toLocaleString() : "none yet"}.`} muted={!metricsStatus.enabled} />
          <HealthCard icon={LineChart} label="Prometheus" value={prometheus.ok ? "Ready" : "Attention"} note={prometheus.message} muted={!prometheus.ok} />
          <HealthCard icon={LineChart} label="Grafana" value={grafana.ok ? "Ready" : "Internal"} note={grafana.message} muted={!grafana.ok} />
          <HealthCard icon={Clock3} label="Workers" value="Available" note="Reminder worker sends idempotent care emails when enabled." />
          <HealthCard icon={Box} label="Backups" value={backupFiles.length ? `${backupFiles.length} file(s)` : "Not wired yet"} note={backupFiles.length ? "Readable backup files found under backups." : "Operator backup scripts exist; no readable files were found."} muted={!backupFiles.length} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><EddyIcon size={24} className="h-6 w-6" /> Eddy Usage</CardTitle><p className="text-sm text-muted-foreground">Database-backed quotas count provider attempts, including mock-provider requests and failures that reached the provider.</p></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {eddyUsage.map((usage) => <div key={usage.featureKey} className="rounded-lg border border-border bg-background/55 p-3"><div className="flex items-start justify-between gap-2"><div className="font-semibold text-primary">{usage.label}</div><Badge>{usage.enabled ? "enabled" : "disabled"}</Badge></div><div className="mt-3 grid gap-1 font-mono text-xs text-muted-foreground"><span>User today: {usage.dailyUser.used}/{usage.dailyUser.limit} · {usage.dailyUser.remaining} left</span><span>Collection today: {usage.dailyCollection.used}/{usage.dailyCollection.limit} · {usage.dailyCollection.remaining} left</span><span>Collection month: {usage.monthlyCollection.used}/{usage.monthlyCollection.limit} · {usage.monthlyCollection.remaining} left</span></div></div>)}
          </div>
          <div><h4 className="font-semibold text-primary">Recent Eddy requests</h4><div className="mt-2 grid gap-2">{recentAiRequests.length ? recentAiRequests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/45 p-3 text-sm"><span><span className="font-semibold">{request.featureKey}</span> · {request.provider}{request.model ? ` / ${request.model}` : ""}</span><span className="flex items-center gap-2"><Badge>{request.status}</Badge><span className="font-mono text-xs text-muted-foreground">{request.createdAt.toLocaleString()}</span></span></div>) : <EmptyLine text="No structured Eddy requests have been recorded yet." />}</div></div>
          <p className="text-xs text-muted-foreground">Per-user and per-collection overrides are supported in the data model. An override editor can be added here when Fluxpoint introduces additional admin roles.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Metric Sync Logs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentMetricLogs.length ? recentMetricLogs.map((log) => (
            <div key={log.id} className="rounded-md border border-border bg-background/55 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-primary">{log.action}</div>
                <Badge>{log.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{log.message ?? "No message."}</p>
              <div className="mt-2 font-mono text-xs text-muted-foreground">{log.createdAt.toLocaleString()}</div>
            </div>
          )) : <EmptyLine text="No metrics sync logs yet. Aquarium dashboard syncs and token creation will appear here." />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><HardDriveDownload className="h-5 w-5 text-water" /> Backup Files</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {backupFiles.length ? backupFiles.map((file) => (
            <div key={file.name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3">
              <div>
                <div className="font-mono text-sm font-semibold text-primary">{file.name}</div>
                <div className="text-xs text-muted-foreground">{file.modifiedAt.toLocaleString()}</div>
              </div>
              <Badge>{Math.ceil(file.size / 1024)} KB</Badge>
            </div>
          )) : <EmptyLine text="No readable backup files found. Use the operator-run backup scripts documented in docs/deployment." />}
          <p className="text-xs text-muted-foreground">Restore remains operator-only; the UI does not run destructive database actions.</p>
        </CardContent>
      </Card>
    </div>
  );
}

async function getBackupFiles() {
  const backupDir = path.join(process.cwd(), "backups");
  try {
    const entries = await readdir(backupDir);
    const files = await Promise.all(entries.slice(0, 12).map(async (name) => {
      const filePath = path.join(backupDir, name);
      const info = await stat(filePath);
      if (!info.isFile()) return null;
      return { name, size: info.size, modifiedAt: info.mtime };
    }));
    return files.filter(Boolean).sort((a, b) => b!.modifiedAt.getTime() - a!.modifiedAt.getTime()) as { name: string; size: number; modifiedAt: Date }[];
  } catch {
    return [];
  }
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}

function HealthCard({
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
    <div className="rounded-md border border-border bg-background/55 p-4">
      <Icon className={muted ? "h-5 w-5 text-muted-foreground" : "h-5 w-5 text-water"} />
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono font-semibold text-primary">{value}</div>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
