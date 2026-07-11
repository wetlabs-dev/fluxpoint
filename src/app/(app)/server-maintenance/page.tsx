import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArchiveRestore, HardDrive, ShieldCheck, Wrench } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { isServerAdmin } from "@/domains/server/server-admin";
import { runServerHealthChecks } from "@/domains/server/health-checks";
import { backupCleanupPreview, backupFolders, validateBackupForRestore } from "@/domains/server/backup-service";
import { collectServerMetricData, formatBytes, serverMetricHistory } from "@/domains/server/server-metrics";
import { cleanupBackups, collectServerMetricsNow, createRestorePlan, removeBackup, requestSitewideBackup, resolveIncident, updateMaintenanceMode, updateServerMaintenanceSettings } from "@/domains/server/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ServerMetricChart } from "@/components/server/ServerMetricChart";
import { restoreDefaultWorkflows } from "@/domains/workflows/actions";
import { formatDateTimeLocalInput, userTimeZone } from "@/lib/dates/user-timezone";
import { overrideSafetyReview, removeSafetyReviewedPhoto } from "@/domains/media/moderation-actions";
import { getServerMaintenanceSettings } from "@/domains/server/settings";
import { getWorkerStatuses } from "@/domains/server/worker-status";

export const dynamic = "force-dynamic";

export default async function ServerMaintenancePage({ searchParams }: { searchParams: Promise<{ backup?: string; retentionDays?: string }> }) {
  const user = await requireUser();
  if (!(await isServerAdmin(user))) notFound();
  const timeZone = userTimeZone(user);
  const params = await searchParams;
  const retentionDays = Number(params.retentionDays || process.env.BACKUP_RETENTION_DAYS || 180);
  const [checks, historyRows, folders, cleanup, maintenance, settings, incidents, workerRuns, restorePlans, stats, operationalLogs, notificationState, auditState, workflowState, workerStatuses] = await Promise.all([
    runServerHealthChecks(),
    serverMetricHistory(),
    backupFolders(),
    backupCleanupPreview(retentionDays),
    prisma.maintenanceMode.findUnique({ where: { id: "global" }, include: { startedBy: true, endedBy: true } }),
    getServerMaintenanceSettings(),
    prisma.serverIncident.findMany({ orderBy: { detectedAt: "desc" }, take: 20 }),
    prisma.serverWorkerRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    prisma.restorePlan.findMany({ include: { backupRun: true, requestedBy: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    Promise.all([prisma.user.count(), prisma.collection.count(), prisma.aquarium.count(), prisma.mediaAsset.count(), prisma.accountRequest.count({ where: { status: "PENDING" } })]),
    prisma.auditLog.findMany({ where: { OR: [{ scope: "SERVER" }, { severity: { in: ["WARNING", "CRITICAL"] } }] }, include: { actor: true, collection: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    Promise.all([
      prisma.pushSubscription.count({ where: { enabled: true, revokedAt: null } }),
      prisma.pushSubscription.count({ where: { revokedAt: { not: null } } }),
      prisma.notificationDelivery.count({ where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.notificationDelivery.findMany({ include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 12 })
    ]),
    Promise.all([
      prisma.auditLog.count({ where: { severity: "WARNING", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.auditLog.count({ where: { severity: "CRITICAL", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.auditLog.count({ where: { action: { contains: "DELETE" }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })
    ]),
    Promise.all([
      prisma.workflowTemplate.count({ where: { status: "ACTIVE" } }),
      prisma.workflowRun.count({ where: { status: { in: ["RUNNING", "ACTIVE", "PAUSED"] } } }),
      prisma.workflowStepRun.count({ where: { status: { in: ["READY", "DUE", "WAITING", "PENDING", "BLOCKED"] }, dueAt: { lte: new Date() } } }),
      prisma.workflowNotification.count({ where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } } })
    ]),
    getWorkerStatuses()
  ]);
  const live = await collectServerMetricData();
  const history = historyRows.map((row) => ({ capturedAt: row.capturedAt, metrics: row.metrics as any }));
  if (!history.length || Date.now() - history[history.length - 1].capturedAt.getTime() > 5 * 60 * 1000) history.push({ capturedAt: new Date(), metrics: live });
  const latest = history[history.length - 1]?.metrics || live;
  const selected = params.backup ? folders.find((folder) => folder.id === params.backup) : null;
  const validation = selected ? await validateBackupForRestore(selected.id) : null;
  const latestEstimates = await prisma.storageEstimate.findMany({ include: { collection: true }, orderBy: { measuredAt: "desc" }, take: 50 });
  const pendingSafetyReviews = await prisma.imageModerationReview.findMany({
    where: { status: "PENDING", reviewType: "NSFW" },
    include: { photo: { select: { id: true, originalFilename: true, moderationStatus: true, createdAt: true } }, uploaderUser: { select: { id: true, email: true, name: true, disabledAt: true } }, collection: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 25
  });
  const estimates = [...new Map(latestEstimates.map((item) => [item.collectionId, item])).values()];
  const memoryPoints = history.map((row) => Number(row.metrics.memory?.usedPercent || 0));
  const diskPoints = history.map((row) => Number(row.metrics.disk?.usedPercent || 0));
  const networkPoints = history.map((row, index) => index ? Math.max(0, (Number(row.metrics.network?.rxBytes || 0) - Number(history[index - 1].metrics.network?.rxBytes || 0)) / Math.max(1, (row.capturedAt.getTime() - history[index - 1].capturedAt.getTime()) / 1000)) : 0);
  const openIncidents = incidents.filter((incident) => incident.status === "OPEN");
  const criticalCount = openIncidents.filter((item) => item.severity === "CRITICAL").length + checks.filter((check) => check.status === "CRITICAL").length;
  const warningCount = openIncidents.filter((item) => item.severity === "WARNING").length + checks.filter((check) => check.status === "WARNING").length;
  const informationCount = openIncidents.filter((item) => item.severity === "INFO").length + checks.filter((check) => check.status === "INFO").length;
  const openFindingCount = openIncidents.filter((item) => item.severity === "WARNING" || item.severity === "CRITICAL").length + checks.filter((check) => check.status === "WARNING" || check.status === "CRITICAL").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Server Maintenance" eyebrow="Operations and recovery"><Badge>{process.env.SERVER_METRICS_ENABLED === "false" ? "metrics disabled" : "48-hour metrics"}</Badge></PageHeader>

      <nav className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-2 text-sm font-semibold">
        {[['#health','Health'],['#image-moderation','Image moderation'],['#metrics','Metrics'],['#settings','Settings'],['#storage','Storage'],['#maintenance','Maintenance'],['#backups','Backups'],['#restore-planning','Restore'],['#notifications','Notifications']].map(([href,label]) => <a key={href} href={href} className="shrink-0 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-primary">{label}</a>)}
        <Link href="/server-maintenance/account-requests" className="shrink-0 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-primary">Account requests</Link>
        <Link href="/server-maintenance/audit-log" className="shrink-0 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-primary">Audit log</Link>
        <Link href="/server-maintenance/ai-jobs" className="shrink-0 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-primary">AI jobs</Link>
        <Link href="/server-maintenance/data-reset" className="shrink-0 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-primary">Data reset</Link>
      </nav>

      <section data-docs-target="server-maintenance-stats" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Users" value={stats[0]} href="/server-maintenance/users" /><Stat label="Account requests" value={stats[4]} href="/server-maintenance/account-requests" /><Stat label="Collections" value={stats[1]} href="/server-maintenance/collections" /><Stat label="Aquariums" value={stats[2]} /><Stat label="Photos" value={stats[3]} />
      </section>

      <Card id="health" data-docs-target="server-health-card" className="scroll-mt-20">
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Server Health</CardTitle><p className="mt-1 text-sm text-muted-foreground">Open incidents and real operational checks.</p></div><div className="flex gap-2"><Badge>{openFindingCount} open findings</Badge><Badge>{incidents.filter((item) => item.status === "RESOLVED").length} resolved incidents</Badge></div></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3"><IncidentStat label="Critical" value={criticalCount} tone="critical" /><IncidentStat label="Warning" value={warningCount} tone="warning" /><IncidentStat label="Information" value={informationCount} /></div>
          <div className="space-y-2">{incidents.length ? incidents.map((incident) => <div key={incident.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3"><div><div className="font-semibold text-primary">{incident.title}</div><div className="text-xs text-muted-foreground">{incident.category.toLowerCase()} · {incident.status.toLowerCase()} · {format(incident.detectedAt, "MMM d, yyyy h:mm a")}</div></div><div className="flex items-center gap-2"><Badge>{incident.severity}</Badge>{incident.status === "OPEN" ? <form action={resolveIncident}><input type="hidden" name="id" value={incident.id} /><Button type="submit" variant="secondary">Resolve</Button></form> : null}</div></div>) : <Empty text="No server incidents recorded." />}</div>
        </CardContent>
      </Card>

      <Card data-docs-target="server-health-checks">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-water" /> Health Checks</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border rounded-md border border-border">{checks.map((check) => <div key={check.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 text-sm"><div className="min-w-0"><div className="font-semibold text-primary">{check.label}</div><div className="break-words text-xs text-muted-foreground">{check.message}</div></div><StatusBadge status={check.status} /></div>)}</CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Worker health</CardTitle><p className="text-sm text-muted-foreground">Disabled optional workers are informational. Enabled workers warn only when they have never run, are stale, or fail.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{workerStatuses.map((worker)=><div key={worker.name} className="rounded-md border border-border bg-background/55 p-3"><div className="flex items-center justify-between gap-2"><strong>{worker.label}</strong><Badge>{worker.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{worker.enabled?`${Math.round(worker.intervalMs/1000)}s interval`:`Disabled via ${worker.enabledEnv}`}</p>{worker.href?<Link href={worker.href} className="mt-2 inline-block text-sm font-semibold text-water underline">Open queue</Link>:null}</div>)}</CardContent></Card>

      <Card id="image-moderation" className="scroll-mt-20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Image Moderation Reviews</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Safety-flagged uploads stay hidden while server administrators resolve them.</p>
            </div>
            <Badge>{pendingSafetyReviews.length} pending safety review{pendingSafetyReviews.length === 1 ? "" : "s"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingSafetyReviews.length ? pendingSafetyReviews.map((review) => (
            <div key={review.id} className="grid gap-3 rounded-md border border-red-300 bg-red-50/70 p-3 text-sm dark:border-red-900 dark:bg-red-950/20 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-primary">{review.photo.originalFilename}</span>
                  <Badge>{review.photo.moderationStatus.toLowerCase()}</Badge>
                  <Badge>{review.collection.name}</Badge>
                </div>
                <p className="text-muted-foreground">{review.reason || "OpenAI image moderation flagged this upload as unsafe."}</p>
                <p className="font-mono text-xs text-muted-foreground">Uploader: {review.uploaderUser?.email || "unknown"} · uploaded {format(review.photo.createdAt, "MMM d, yyyy h:mm a")}</p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <form action={overrideSafetyReview}>
                  <input type="hidden" name="reviewId" value={review.id} />
                  <Button type="submit" variant="secondary">False positive</Button>
                </form>
                <form action={removeSafetyReviewedPhoto} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="reviewId" value={review.id} />
                  {review.uploaderUser && !review.uploaderUser.disabledAt ? <label className="flex items-center gap-1 rounded-md border border-red-300 bg-background px-2 py-1 text-xs font-semibold"><input type="checkbox" name="disableUploader" /> Disable uploader</label> : null}
                  <Button type="submit" variant="secondary">Remove</Button>
                </form>
              </div>
            </div>
          )) : <Empty text="No safety-flagged uploads are waiting for server-admin review." />}
        </CardContent>
      </Card>

      <Card id="metrics" data-docs-target="server-metrics-card" className="scroll-mt-20">
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Server Metrics</CardTitle><p className="mt-1 text-sm text-muted-foreground">Host/container snapshots retained for {process.env.SERVER_METRICS_RETENTION_HOURS || 48} hours.</p></div><div className="flex flex-wrap items-center gap-2"><Badge>{process.env.SERVER_METRICS_ENABLED === "false" ? "worker disabled" : historyRows.length ? `last persisted ${format(historyRows[historyRows.length - 1].capturedAt, "MMM d h:mm a")}` : "worker enabled · awaiting first snapshot"}</Badge><form action={collectServerMetricsNow}><Button type="submit" variant="secondary">Collect snapshot now</Button></form></div></div></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <ServerMetricChart label="Memory" value={`${latest.memory.usedPercent.toFixed(1)}%`} detail={`${formatBytes(latest.memory.usedBytes)} used of ${formatBytes(latest.memory.totalBytes)}`} points={memoryPoints} />
          <ServerMetricChart label="Disk" value={`${latest.disk.usedPercent.toFixed(1)}%`} detail={`${formatBytes(latest.disk.usedBytes)} used of ${formatBytes(latest.disk.totalBytes)}`} points={diskPoints} />
          <ServerMetricChart label="Network RX" value={`${formatBytes(networkPoints[networkPoints.length - 1] || 0)}/s`} detail={`TX total ${formatBytes(latest.network.txBytes)}`} points={networkPoints} />
        </CardContent>
      </Card>

      <Card id="settings" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Maintenance Settings</CardTitle>
          <p className="text-sm text-muted-foreground">Tune server-maintenance alert thresholds without rebuilding Fluxpoint.</p>
        </CardHeader>
        <CardContent>
          <form action={updateServerMaintenanceSettings} className="grid gap-4 rounded-md border border-border bg-background/55 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="grid gap-1 text-sm font-medium">
              <span>Disk warning threshold (%)</span>
              <Input type="number" name="diskWarningThresholdPercent" min="1" max="99" step="0.1" defaultValue={settings.diskWarningThresholdPercent} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <span>Disk critical threshold (%)</span>
              <Input type="number" name="diskCriticalThresholdPercent" min="1" max="99" step="0.1" defaultValue={settings.diskCriticalThresholdPercent} />
            </label>
            <Button type="submit">Save thresholds</Button>
            <p className="text-sm text-muted-foreground md:col-span-3">
              Current disk usage is <span className="font-mono font-semibold text-primary">{latest.disk.usedPercent.toFixed(1)}%</span>.
              Defaults are 80% warning and 90% critical; set warning to 90% to avoid alerts while usage hovers near 80%.
            </p>
          </form>
        </CardContent>
      </Card>

      <Card id="storage" className="scroll-mt-20">
        <CardHeader><CardTitle>Storage Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-5"><StorageBreakdown storage={latest.storage} diskUsed={latest.disk.usedBytes} /><div><h3 className="mb-2 font-semibold text-primary">Collection storage estimates</h3>{estimates.length ? <div className="space-y-2">{estimates.map((estimate) => <div key={estimate.id} className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"><span className="font-semibold text-primary">{estimate.collection.name}</span><span>{formatBytes(Number(estimate.uploadBytes))}</span><span>{estimate.recordCount} records</span><span>{estimate.photoCount} photos</span></div>)}</div> : <Empty text="No collection estimates yet. Enable and run the metrics worker." />}</div></CardContent>
      </Card>

      <Card id="maintenance" className="scroll-mt-20">
        <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-water" /> Maintenance Mode</CardTitle><StatusBadge status={maintenance?.enabled ? "WARNING" : "OK"} label={maintenance?.enabled ? "enabled" : "disabled"} /></div></CardHeader>
        <CardContent><form action={updateMaintenanceMode} className="grid gap-4"><div className="flex gap-5 text-sm font-medium"><label className="flex items-center gap-2"><input type="radio" name="enabled" value="false" defaultChecked={!maintenance?.enabled} /> Disabled</label><label className="flex items-center gap-2"><input type="radio" name="enabled" value="true" defaultChecked={Boolean(maintenance?.enabled)} /> Enabled</label></div><Textarea name="message" defaultValue={maintenance?.message || ""} placeholder="Optional message for keepers" /><label className="grid gap-1 text-sm font-medium"><span>Expected return</span><Input type="datetime-local" name="expectedReturnAt" defaultValue={formatDateTimeLocalInput(maintenance?.expectedReturnAt, timeZone)} /></label><Button type="submit" className="w-fit">Save maintenance mode</Button></form></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Workflow Operations</CardTitle><p className="text-sm text-muted-foreground">Template availability, active runs, and due workflow notification state.</p></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4"><IncidentStat label="Templates" value={workflowState[0]} /><IncidentStat label="Active runs" value={workflowState[1]} /><IncidentStat label="Due steps" value={workflowState[2]} tone={workflowState[2] ? "warning" : undefined} /><IncidentStat label="Due alerts" value={workflowState[3]} tone={workflowState[3] ? "warning" : undefined} /></div>
          <form action={restoreDefaultWorkflows}><Button type="submit" variant="secondary">Re-add default workflows</Button></form>
        </CardContent>
      </Card>

      <Card id="backups" data-docs-target="server-backups-card" className="scroll-mt-20">
        <CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-water" /> Backups</CardTitle><p className="text-sm text-muted-foreground">Sitewide backups include PostgreSQL, uploads, labels, reports, checksums, and a manifest.</p></CardHeader>
        <CardContent className="space-y-5"><form action={requestSitewideBackup} className="flex flex-col gap-3 rounded-md border border-border bg-background/55 p-3 sm:flex-row"><Input name="notes" placeholder="Optional backup notes" /><Button type="submit" className="shrink-0">Request sitewide backup</Button></form><div className="grid gap-3 lg:grid-cols-2">{folders.length ? folders.map((backup) => <BackupCard key={backup.id} backup={backup} selected={selected?.id === backup.id} />) : <Empty text="No backup requests or folders yet." />}</div>
          <div className="rounded-md border border-border bg-muted/35 p-4"><h3 className="font-semibold text-primary">Cleanup preview</h3><form method="get" className="mt-3 flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm"><span>Retention days</span><Input type="number" name="retentionDays" min="1" max="3650" defaultValue={cleanup.days} /></label><Button type="submit" variant="secondary">Preview cleanup</Button></form><p className="mt-3 text-sm text-muted-foreground">{cleanup.candidates.length} complete backup(s), {formatBytes(cleanup.totalBytes)}, older than {format(cleanup.cutoff, "MMM d, yyyy")}.</p>{cleanup.candidates.length ? <form action={cleanupBackups} className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="retentionDays" value={cleanup.days} /><label className="grid gap-1 text-sm"><span>Type DELETE</span><Input name="confirmation" required /></label><Button type="submit">Apply cleanup</Button></form> : null}</div>
        </CardContent>
      </Card>

      <Card id="restore-planning" className="scroll-mt-20">
        <CardHeader><CardTitle className="flex items-center gap-2"><ArchiveRestore className="h-5 w-5 text-water" /> Restore Planning</CardTitle><p className="text-sm text-muted-foreground">Fluxpoint validates and records an operator plan. The UI never executes a restore.</p></CardHeader>
        <CardContent className="space-y-5">{selected && validation ? <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-md border border-border bg-background/55 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-mono font-semibold text-primary">{selected.folderName || selected.id}</h3><Badge>{validation.readiness}</Badge></div><ValidationList title="Passed" items={validation.passed} /><ValidationList title="Warnings" items={validation.warnings} /><ValidationList title="Failed" items={validation.failed} />{selected.manifest ? <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-primary">Manifest preview</summary><pre className="mt-2 max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(selected.manifest,null,2)}</pre></details> : null}</div><form action={createRestorePlan} className="grid content-start gap-3 rounded-md border border-border bg-background/55 p-4"><input type="hidden" name="backupRunId" value={selected.id} /><Textarea name="notes" placeholder="Context for this restore plan" /><Button type="submit">Create operator restore plan</Button><p className="text-xs text-muted-foreground">No database, archive, or container command will run.</p></form></div> : <Empty text="Select a completed backup above to validate it and create a restore plan." />}
          <div><h3 className="mb-2 font-semibold text-primary">Restore history</h3>{restorePlans.length ? <div className="space-y-3">{restorePlans.map((plan) => <details key={plan.id} className="rounded-md border border-border bg-background/55 p-3"><summary className="cursor-pointer font-semibold text-primary">{plan.backupRun.folderName || plan.backupRun.id} · {plan.status.toLowerCase()} · {format(plan.createdAt, "MMM d, yyyy h:mm a")}</summary><p className="mt-2 text-sm text-muted-foreground">{plan.notes || "No notes."}</p><pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{plan.operatorSteps}</pre></details>)}</div> : <Empty text="No restore plans have been created." />}</div>
        </CardContent>
      </Card>

      <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Priority Audit Events</CardTitle><p className="mt-1 text-sm text-muted-foreground">Recent server, destructive, warning, and critical activity.</p></div><Link href="/server-maintenance/audit-log" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">Open full audit log</Link></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><IncidentStat label="7d warnings" value={auditState[0]} tone={auditState[0] ? "warning" : undefined} /><IncidentStat label="7d critical" value={auditState[1]} tone={auditState[1] ? "critical" : undefined} /><IncidentStat label="7d destructive" value={auditState[2]} tone={auditState[2] ? "warning" : undefined} /></div><div className="space-y-2">{operationalLogs.length ? operationalLogs.map((log) => <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3 text-sm"><span><strong>{log.action.replaceAll("_"," ").toLowerCase()}</strong> · {log.summary} · {log.actorEmail || log.actor?.email || "system"}{log.collection?.name ? ` · ${log.collection.name}` : ""}</span><span className="flex items-center gap-2"><Badge>{log.severity}</Badge><span className="font-mono text-xs text-muted-foreground">{format(log.createdAt,"MMM d h:mm a")}</span></span></div>) : <Empty text="No priority audit events yet." />}</div></CardContent></Card>

      <Card><CardHeader><CardTitle>Worker Runs</CardTitle></CardHeader><CardContent className="space-y-2">{workerRuns.length ? workerRuns.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3 text-sm"><span><strong>{run.workerName}</strong> · {run.summary || run.error || "No summary"}</span><span className="flex items-center gap-2"><Badge>{run.status}</Badge><span className="font-mono text-xs text-muted-foreground">{format(run.startedAt, "MMM d h:mm a")}</span></span></div>) : <Empty text="No durable worker runs yet." />}</CardContent></Card>
      <Card id="notifications" className="scroll-mt-20"><CardHeader><CardTitle>Notification Delivery</CardTitle><p className="text-sm text-muted-foreground">Web Push devices and recent email/push delivery state.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><IncidentStat label="Active push devices" value={notificationState[0]} /><IncidentStat label="Revoked devices" value={notificationState[1]} /><IncidentStat label="24h failures" value={notificationState[2]} tone={notificationState[2] ? "warning" : undefined} /></div><div className="space-y-2">{notificationState[3].length ? notificationState[3].map((delivery) => <div key={delivery.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3 text-sm"><span><strong>{delivery.type.replaceAll("_", " ").toLowerCase()}</strong> · {delivery.channel.toLowerCase()} · {delivery.user.email}</span><span className="flex items-center gap-2"><Badge>{delivery.status}</Badge><span className="font-mono text-xs text-muted-foreground">{format(delivery.createdAt, "MMM d h:mm a")}</span></span></div>) : <Empty text="No notification deliveries recorded yet." />}</div></CardContent></Card>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) { const content = <Card><CardContent className="p-4"><div className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">{label}</div><div className="mt-2 font-mono text-3xl font-semibold text-primary">{value}</div>{href ? <div className="mt-2 text-xs font-semibold text-water">Manage {label.toLowerCase()} →</div> : null}</CardContent></Card>; return href ? <Link href={href}>{content}</Link> : content; }
function IncidentStat({ label, value, tone }: { label: string; value: number; tone?: string }) { return <div className={`rounded-md border p-3 ${tone === "critical" ? "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100" : tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" : "border-border bg-background/55"}`}><div className="text-xs uppercase tracking-[.14em]">{label}</div><div className="font-mono text-2xl font-semibold">{value}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>; }
function StatusBadge({ status, label }: { status: string; label?: string }) { return <Badge className={`shrink-0 ${status === "OK" ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100" : status === "INFO" ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100" : status === "CRITICAL" ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}`}>{label || status.toLowerCase()}</Badge>; }
function StorageBreakdown({ storage, diskUsed }: { storage: any; diskUsed: number }) { const entries = [["Uploaded photos",storage.uploadsBytes,"bg-water"],["Labels",storage.labelsBytes,"bg-emerald-500"],["Reports",storage.reportsBytes,"bg-violet-500"],["Database",storage.databaseBytes,"bg-orange-400"],["Backups",storage.backupsBytes,"bg-blue-500"],["Code / app image",storage.codeBytes,"bg-cyan-500"],["Other server usage",storage.otherBytes,"bg-muted-foreground"]] as const; return <div><div className="flex h-3 overflow-hidden rounded-full bg-muted">{entries.map(([label,bytes,color]) => <div key={label} className={color} style={{width:`${diskUsed ? Math.max(bytes ? .35 : 0,bytes/diskUsed*100) : 0}%`}} title={`${label}: ${formatBytes(bytes)}`} />)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{entries.map(([label,bytes,color]) => <div key={label} className="rounded-md border border-border bg-background/55 p-3"><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</div><div className="mt-1 font-mono font-semibold text-primary">{formatBytes(bytes)}</div></div>)}</div></div>; }
function BackupCard({ backup, selected }: { backup: any; selected: boolean }) { return <div className={`rounded-md border p-4 ${selected ? "border-water bg-water/10" : "border-border bg-background/55"}`}><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-sm font-semibold text-primary">{backup.folderName || `queued-${backup.id.slice(-8)}`}</div><div className="text-xs text-muted-foreground">Requested {format(backup.request.requestedAt,"MMM d, yyyy h:mm a")} by {backup.request.requestedBy?.email || "system"}{backup.durationMs != null ? ` · duration ${(backup.durationMs / 1000).toFixed(1)}s` : ""}</div></div><Badge>{backup.status}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{backup.request.notes || backup.error || "No notes."}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{formatBytes(backup.diskBytes)}</span>{backup.artifacts.map((item:any)=><span key={item.id} className="rounded-full bg-muted px-2 py-1">{item.type.toLowerCase()}: {formatBytes(Number(item.sizeBytes))}</span>)}</div><div className="mt-3 flex flex-wrap gap-2">{backup.status === "COMPLETE" ? <Link href={`/server-maintenance?backup=${backup.id}#restore-planning`} className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-primary">{selected ? "Selected" : "Validate / plan restore"}</Link> : null}{!["REQUESTED","RUNNING"].includes(backup.status) ? <form action={removeBackup} className="flex items-center gap-2"><input type="hidden" name="runId" value={backup.id} /><Input name="confirmation" placeholder="Type DELETE" className="max-w-32" required /><Button type="submit" variant="secondary">Delete</Button></form> : null}</div></div>; }
function ValidationList({ title, items }: { title: string; items: string[] }) { if (!items.length) return null; return <div className="mt-3"><div className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">{title}</div><ul className="mt-1 space-y-1 text-sm">{items.map((item)=><li key={item}>• {item}</li>)}</ul></div>; }
