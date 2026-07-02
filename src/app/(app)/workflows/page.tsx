import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { WorkflowTemplateForm } from "@/components/workflows/WorkflowTemplateForm";
import { archiveWorkflowTemplate, createWorkflowTemplate, restoreDefaultWorkflows, startWorkflowTemplate, updateWorkflowTemplate } from "@/domains/workflows/actions";
import { activeWorkflowRunStatuses, openWorkflowStepStatuses } from "@/domains/workflows/workflow-service";
import { workflowStepLabel } from "@/domains/workflows/step-types";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const [templates, runs, dueSteps, aquariums] = await Promise.all([
    prisma.workflowTemplate.findMany({
      where: { OR: [{ collectionId: collection.id }, { collectionId: null }], status: "ACTIVE" },
      include: { steps: { orderBy: [{ sortOrder: "asc" }, { order: "asc" }] }, runs: { where: { collectionId: collection.id } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }]
    }),
    prisma.workflowRun.findMany({
      where: { collectionId: collection.id, status: { in: activeWorkflowRunStatuses() } },
      include: { aquarium: true, workflowTemplate: true, stepRuns: { orderBy: { sortOrder: "asc" } } },
      orderBy: { startedAt: "desc" },
      take: 12
    }),
    prisma.workflowStepRun.findMany({
      where: { collectionId: collection.id, status: { in: openWorkflowStepStatuses() }, dueAt: { lte: new Date() }, workflowRun: { status: { in: activeWorkflowRunStatuses() } } },
      include: { workflowRun: { include: { aquarium: true } }, workflowStep: true },
      orderBy: { dueAt: "asc" },
      take: 8
    }),
    prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, select: { id: true, name: true, generatedName: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <div>
      <PageHeader title="Workflows" eyebrow="Repeatable care routines">
        <Badge>{runs.length} active</Badge>
        <Badge>{dueSteps.length} due</Badge>
      </PageHeader>

      <section className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Active workflow runs</CardTitle>
            <p className="text-sm text-muted-foreground">Multiple runs can be started from the same template. Each run keeps its own step state and alerts.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {runs.length ? runs.map((run) => {
              const completed = run.stepRuns.filter((step) => ["COMPLETED", "SKIPPED"].includes(step.status)).length;
              return (
                <Link key={run.id} href={`/workflows/runs/${run.id}`} className="block rounded-md border border-border bg-background/60 p-3 transition hover:border-primary/50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><div className="font-semibold text-primary">{run.title || run.workflowTemplate.name}</div><p className="text-sm text-muted-foreground">{run.aquarium?.generatedName || run.aquarium?.name || "Collection workflow"} · started {formatDistanceToNow(run.startedAt, { addSuffix: true })}</p></div>
                    <Badge>{completed}/{run.stepRuns.length} steps</Badge>
                  </div>
                </Link>
              );
            }) : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No active workflow runs yet. Start one from a template below.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Due workflow steps</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dueSteps.length ? dueSteps.map((step) => (
              <Link key={step.id} href={`/workflows/runs/${step.workflowRunId}`} className="block rounded-md bg-muted/45 p-3 text-sm">
                <span className="font-semibold text-primary">{step.titleSnapshot || step.workflowStep.title}</span>
                <span className="block text-muted-foreground">{step.workflowRun.aquarium?.generatedName || step.workflowRun.aquarium?.name || "Collection"} · {step.status.toLowerCase()}</span>
              </Link>
            )) : <p className="text-sm text-muted-foreground">No workflow steps are due right now.</p>}
          </CardContent>
        </Card>
      </section>

      <details className="mb-6 rounded-lg border border-border bg-card shadow-soft">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-primary">+ Create workflow template</summary>
        <div className="border-t border-border p-4"><WorkflowTemplateForm action={createWorkflowTemplate} aquariums={aquariums} /></div>
      </details>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{template.name}</CardTitle>
                <Badge>{template.category}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <p className="text-xs font-semibold text-primary">{template.runs.length} run(s) in this collection</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-2 text-sm">
                {template.steps.map((step) => (
                  <li key={step.id} className="rounded-md bg-muted/55 p-3">
                    <span className="font-semibold">{step.sortOrder || step.order}. {step.title}</span>
                    <span className="block text-muted-foreground">{workflowStepLabel(step.stepType)}{step.waitAfterPreviousMinutes ? ` · waits ${step.waitAfterPreviousMinutes} min` : ""}</span>
                  </li>
                ))}
              </ol>
              <form action={startWorkflowTemplate} className="grid gap-2 rounded-md border border-border bg-background/60 p-3">
                <input type="hidden" name="workflowTemplateId" value={template.id} />
                <select name="aquariumId" defaultValue={template.defaultAquariumId || ""} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Collection-level workflow</option>
                  {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName || aquarium.name}</option>)}
                </select>
                <input name="notes" placeholder="Run notes (optional)" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <Button type="submit">Start workflow</Button>
              </form>
              {template.collectionId === collection.id ? (
                <details className="rounded-md border border-border">
                  <summary className="cursor-pointer p-3 font-semibold text-primary">Edit template</summary>
                  <div className="border-t border-border p-3"><WorkflowTemplateForm action={updateWorkflowTemplate} template={template} aquariums={aquariums} /></div>
                </details>
              ) : null}
              {template.collectionId === collection.id ? <form action={archiveWorkflowTemplate}><input type="hidden" name="id" value={template.id} /><Button type="submit" variant="secondary">Archive template</Button></form> : null}
            </CardContent>
          </Card>
        ))}
        {!templates.length ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">No workflow templates are available. Re-add Fluxpoint starter workflows or create your own.</p>
              <form action={restoreDefaultWorkflows}><Button type="submit">Re-add default workflows</Button></form>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
