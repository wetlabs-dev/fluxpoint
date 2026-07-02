import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { cancelWorkflow, completeWorkflowStep, skipWorkflowStep } from "@/domains/workflows/actions";
import { workflowStepLabel } from "@/domains/workflows/step-types";

export const dynamic = "force-dynamic";

function configObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function MeasurementFields({ config }: { config: Record<string, unknown> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-semibold">{String(config.measurementLabel || "Measurement")}<input name="result.value" className="rounded-md border border-border bg-background px-3 py-2" /></label>
      <label className="grid gap-1 text-sm font-semibold">Unit<input name="result.unit" defaultValue={String(config.unit || "")} className="rounded-md border border-border bg-background px-3 py-2" /></label>
      {config.targetValue ? <p className="rounded-md bg-muted/45 p-2 text-xs text-muted-foreground sm:col-span-2">Target: {String(config.targetValue)}</p> : null}
    </div>
  );
}

function ChecklistFields({ config }: { config: Record<string, unknown> }) {
  const items = Array.isArray(config.items) ? config.items.map(String) : [];
  return items.length ? (
    <div className="grid gap-2">
      {items.map((item, index) => <label key={`${item}-${index}`} className="flex items-center gap-2 rounded-md bg-muted/45 p-2 text-sm"><input type="checkbox" name={`result.checklist.${index}`} value={item} /> {item}</label>)}
    </div>
  ) : null;
}

export default async function WorkflowRunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { id } = await params;
  const run = await prisma.workflowRun.findFirst({
    where: { id, collectionId: collection.id },
    include: {
      aquarium: true,
      workflowTemplate: true,
      notifications: { orderBy: { scheduledFor: "asc" } },
      stepRuns: { include: { workflowStep: true, completedBy: { select: { name: true, email: true } } }, orderBy: { sortOrder: "asc" } }
    }
  });
  if (!run) notFound();
  const completed = run.stepRuns.filter((step) => ["COMPLETED", "SKIPPED"].includes(step.status)).length;

  return (
    <div>
      <PageHeader title={run.title || run.workflowTemplate.name} eyebrow="Workflow run">
        <Badge>{run.status}</Badge>
        <Badge>{completed}/{run.stepRuns.length} steps</Badge>
      </PageHeader>
      <div className="mb-5 flex flex-wrap gap-3 text-sm">
        <Link href="/workflows" className="font-semibold text-primary underline">Back to workflows</Link>
        {run.aquarium ? <Link href={`/aquariums/${run.aquarium.id}`} className="font-semibold text-primary underline">{run.aquarium.generatedName || run.aquarium.name}</Link> : <span className="text-muted-foreground">Collection-level run</span>}
        <span className="text-muted-foreground">Started {format(run.startedAt, "MMM d, yyyy h:mm a")}</span>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {run.stepRuns.map((step) => {
            const type = step.stepTypeSnapshot || step.workflowStep.stepType;
            const config = configObject(step.configSnapshot || step.workflowStep.config);
            const open = ["READY", "DUE", "PENDING", "BLOCKED"].includes(step.status) && ["RUNNING", "ACTIVE", "PAUSED"].includes(run.status);
            return (
              <Card key={step.id} className={step.status === "DUE" ? "border-amber-400/70" : undefined}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{step.sortOrder}. {step.titleSnapshot || step.workflowStep.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{workflowStepLabel(type)}{step.dueAt ? ` · due ${format(step.dueAt, "MMM d h:mm a")}` : ""}</p>
                    </div>
                    <Badge>{step.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(step.descriptionSnapshot || step.workflowStep.description) ? <p className="text-sm text-muted-foreground">{step.descriptionSnapshot || step.workflowStep.description}</p> : null}
                  {step.completedAt ? <p className="rounded-md bg-muted/45 p-2 text-sm">Completed {format(step.completedAt, "MMM d h:mm a")}{step.completedBy ? ` by ${step.completedBy.name || step.completedBy.email}` : ""}</p> : null}
                  {open ? (
                    <form action={completeWorkflowStep} className="space-y-3 rounded-md border border-border bg-background/55 p-3">
                      <input type="hidden" name="id" value={step.id} />
                      {type === "MEASUREMENT" ? <MeasurementFields config={config} /> : null}
                      {type === "CHECKLIST" ? <ChecklistFields config={config} /> : null}
                      <label className="grid gap-1 text-sm font-semibold">Notes<textarea name="notes" className="min-h-20 rounded-md border border-border bg-background px-3 py-2" /></label>
                      <div className="flex flex-wrap gap-2"><Button type="submit">Complete step</Button><Button formAction={skipWorkflowStep} variant="secondary">Skip step</Button></div>
                    </form>
                  ) : null}
                  {step.notes ? <p className="text-sm text-muted-foreground">Notes: {step.notes}</p> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Run controls</CardTitle></CardHeader>
            <CardContent>
              {["RUNNING", "ACTIVE", "PAUSED"].includes(run.status) ? (
                <form action={cancelWorkflow} className="space-y-3">
                  <input type="hidden" name="id" value={run.id} />
                  <textarea name="notes" placeholder="Cancellation notes" className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                  <Button type="submit" variant="secondary">Cancel workflow</Button>
                </form>
              ) : <p className="text-sm text-muted-foreground">This run is {run.status.toLowerCase()}.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Scheduled alerts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {run.notifications.length ? run.notifications.map((notification) => (
                <div key={notification.id} className="rounded-md bg-muted/45 p-2 text-sm">
                  <span className="font-semibold">{notification.title}</span>
                  <span className="block text-muted-foreground">{notification.channel.toLowerCase()} · {notification.status.toLowerCase()} · {format(notification.scheduledFor, "MMM d h:mm a")}</span>
                </div>
              )) : <p className="text-sm text-muted-foreground">No scheduled workflow alerts.</p>}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
