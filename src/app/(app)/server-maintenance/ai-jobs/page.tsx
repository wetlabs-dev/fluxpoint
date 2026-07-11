import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { requireServerAdmin } from "@/domains/auth/permissions";
import { aiJobOperationsSummary } from "@/domains/ai-jobs/queries";
import { aiJobPriorityLabel, AI_JOB_PRIORITIES } from "@/domains/ai-jobs/priorities";
import { adminCancelAiJob, adminChangeAiJobPriority, adminRetryAiJob } from "@/domains/ai-jobs/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function sanitized(value: unknown) {
  if (!value || typeof value !== "object") return "None";
  const blocked = /(authorization|api.?key|secret|token|base64|b64|binary|image.?data)/i;
  return JSON.stringify(value, (key, item) => blocked.test(key) ? "[redacted]" : typeof item === "string" ? item.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]") : item, 2).slice(0, 4000);
}

export default async function AiJobsAdminPage() {
  await requireServerAdmin();
  const [summary, jobs, worker] = await Promise.all([
    aiJobOperationsSummary(),
    prisma.aiJob.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { email: true } }, collection: { select: { name: true } }, events: { orderBy: { createdAt: "asc" } } } }),
    prisma.serverWorkerRun.findFirst({ where: { workerName: "ai-worker" }, orderBy: { startedAt: "desc" } })
  ]);
  const highWarningMinutes = Number(process.env.AI_JOB_HIGH_PRIORITY_WARNING_MINUTES || 10);
  const highBacklogWarning = summary.oldestHighPending ? Date.now() - summary.oldestHighPending.createdAt.getTime() > highWarningMinutes * 60_000 : false;
  return <div className="space-y-6">
    <PageHeader title="AI Jobs" eyebrow="Server Maintenance" />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Pending", summary.pending], ["Running", summary.running], ["Failed", summary.failed], ["Dead letter", summary.deadLetter], ["Worker", worker?.status ?? "NEVER_RUN"]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xl font-semibold">{value}</div></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Queue health</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground">
      <p>{summary.oldestPending ? `Oldest pending: ${formatDistanceToNow(summary.oldestPending.createdAt)} old.` : "No queued AI work."}</p>
      <p className={highBacklogWarning ? "text-amber-700 dark:text-amber-300" : undefined}>{summary.oldestHighPending ? `Oldest HIGH priority: ${formatDistanceToNow(summary.oldestHighPending.createdAt)} old${highBacklogWarning ? ` — WARNING threshold ${highWarningMinutes} minutes exceeded` : ""}.` : "No HIGH-priority backlog."}</p>
      <div className="flex flex-wrap gap-2">{summary.pendingByPriority.map((tier) => <Badge key={tier.priority}>{aiJobPriorityLabel(tier.priority)}: {tier._count}</Badge>)}</div>
      <p>{summary.latestProviderSuccess ? `Latest real-provider response: ${summary.latestProviderSuccess.createdAt.toLocaleString()}.` : "No recorded real-provider success."}</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Recent jobs</CardTitle></CardHeader><CardContent className="space-y-4">{jobs.map((job) => {
      const payload = job.payload as Record<string, unknown>;
      const result = job.result as Record<string, unknown> | null;
      return <details key={job.id} className="rounded-md border border-border p-4"><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{job.jobType.replaceAll("_", " ")}</div><div className="text-xs text-muted-foreground">{job.collection.name} · {job.user.email} · {aiJobPriorityLabel(job.priority)} · {job.attemptCount}/{job.maxAttempts} attempts</div><div className="mt-1 font-mono text-[11px] text-muted-foreground">{job.id}</div></div><Badge>{job.status}</Badge></div></summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="space-y-2 text-sm"><p><strong>Age:</strong> {formatDistanceToNow(job.createdAt)}</p><p><strong>Aquarium:</strong> {String(payload.aquariumId || "Unknown")}</p><p><strong>Claim:</strong> {job.claimedBy || "Unclaimed"}</p><p><strong>Next retry:</strong> {job.status === "PENDING" && job.attemptCount ? job.availableAt.toLocaleString() : "None"}</p><p><strong>Failure:</strong> {job.errorCode ? `${job.errorCode} — ${job.errorMessage}` : "None"}</p>{typeof result?.imageUrl === "string" ? <a className="text-water underline" href={result.imageUrl}>Generated media</a> : null}</div><div><div className="text-xs font-semibold uppercase tracking-wide">Sanitized payload / result</div><pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">{sanitized({ payload: job.payload, result: job.result })}</pre></div></div>
        <div className="mt-4"><div className="text-xs font-semibold uppercase tracking-wide">Event timeline</div><ol className="mt-2 space-y-2 border-l border-border pl-4">{job.events.map((event) => <li key={event.id} className="text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{event.message}</span><time className="text-xs text-muted-foreground">{event.createdAt.toLocaleString()}</time></div><div className="text-xs text-muted-foreground">{event.eventType}{event.attemptNumber ? ` · attempt ${event.attemptNumber}` : ""}</div></li>)}</ol></div>
        <div className="mt-4 flex flex-wrap gap-2">{["FAILED", "DEAD_LETTER"].includes(job.status) ? <form action={adminRetryAiJob}><input type="hidden" name="id" value={job.id}/><Button type="submit" variant="secondary">Retry</Button></form> : null}{job.status === "PENDING" ? <><form action={adminCancelAiJob}><input type="hidden" name="id" value={job.id}/><Button type="submit" variant="secondary">Cancel</Button></form><form action={adminChangeAiJobPriority} className="flex gap-2"><input type="hidden" name="id" value={job.id}/><select name="priority" defaultValue={aiJobPriorityLabel(job.priority)} className="rounded-md border border-border bg-background px-2 text-sm">{Object.entries(AI_JOB_PRIORITIES).map(([label]) => <option key={label}>{label}</option>)}</select><Button type="submit" variant="secondary">Change priority</Button></form></> : null}</div>
      </details>;
    })}{!jobs.length ? <p className="text-sm text-muted-foreground">No AI jobs have been queued.</p> : null}</CardContent></Card>
  </div>;
}
