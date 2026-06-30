import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ClipboardList, Sprout } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionRole } from "@/domains/auth/permissions";
import {
  addBreedingCareTask,
  addBreedingCohort,
  addBreedingGoal,
  addBreedingMeasurement,
  addBreedingObservation,
  addBreedingParent,
  addBreedingTraitObservation,
  attachBreedingPhoto,
  attachBreedingWorkflow,
  deleteBreedingProject,
  graduateBreedingCohort,
  saveBreedingSummary,
  updateBreedingCohort,
  updateBreedingProject
} from "@/domains/breeding/actions";
import { breedingObservationTypes, breedingParentConfidences, breedingParentRoles, breedingProjectStatuses, breedingQuantityTypes, breedingTraitConfidences, defaultBreedingStages, humanizeBreedingValue } from "@/domains/breeding/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function BreedingProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const role = await getCollectionRole(user.id, collection.id);
  const canDelete = role === "COLLECTION_OWNER";
  const project = await prisma.breedingProject.findFirst({
    where: { id, collectionId: collection.id },
    include: {
      speciesDefinition: { include: { speciesTraits: { where: { collectionId: collection.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } },
      aquarium: true,
      parents: { include: { aquariumItem: { include: { speciesDefinition: true, aquarium: true } } }, orderBy: { createdAt: "asc" } },
      cohorts: { include: { destinationAquarium: true, graduatedItems: true }, orderBy: { createdAt: "asc" } },
      observations: { include: { cohort: true, createdBy: true }, orderBy: { observedAt: "desc" } },
      traitObservations: { include: { speciesTrait: true }, orderBy: { observedAt: "desc" } },
      goals: { orderBy: { createdAt: "asc" } },
      measurements: { include: { cohort: true }, orderBy: { measuredAt: "asc" } },
      photos: { include: { mediaAsset: true, observation: true }, orderBy: { createdAt: "desc" } },
      milestones: { include: { cohort: true }, orderBy: { milestoneAt: "desc" } },
      summaries: { orderBy: { createdAt: "desc" } },
      aquariumEvents: { include: { aquarium: true }, orderBy: { eventDate: "desc" }, take: 12 },
      careTasks: { include: { careSchedule: true }, orderBy: { dueAt: "asc" } },
      workflowRun: { include: { workflowTemplate: true, stepRuns: { include: { workflowStep: true }, orderBy: { workflowStep: { order: "asc" } } } } },
      graduatedItems: true
    }
  });
  if (!project) notFound();
  const [aquariums, items, workflowTemplates, mediaAssets] = await Promise.all([
    prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    prisma.aquariumItem.findMany({ where: { collectionId: collection.id, itemType: { in: ["FISH", "INVERT", "PLANT", "OTHER"] }, status: { notIn: ["ARCHIVED", "DEAD", "REMOVED", "CONSUMED"] } }, include: { speciesDefinition: true, aquarium: true }, orderBy: { name: "asc" }, take: 200 }),
    prisma.workflowTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.mediaAsset.findMany({ where: { collectionId: collection.id, OR: [{ aquariumId: project.aquariumId ?? undefined }, { speciesDefinitionId: project.speciesDefinitionId ?? undefined }] }, orderBy: { createdAt: "desc" }, take: 80 })
  ]);
  const suggestedSummary = buildSummaryDraft(project);
  const stageOptions = Array.from(new Set(Object.values(defaultBreedingStages).flat()));

  return (
    <div className="space-y-6">
      <PageHeader title={project.title} eyebrow="Breeding project">
        <div className="flex flex-wrap gap-2"><Badge>{humanizeBreedingValue(project.projectType)}</Badge><Badge>{humanizeBreedingValue(project.status)}</Badge><Link href="/breeding"><Button variant="secondary">All projects</Button></Link></div>
      </PageHeader>
      <nav className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card p-2 text-sm font-semibold">
        {["overview", "timeline", "cohorts", "traits", "measurements", "photos", "goals", "care", "workflow", "summary"].map((section) => <a key={section} href={`#${section}`} className="whitespace-nowrap rounded-md px-3 py-2 text-primary hover:bg-muted">{humanizeBreedingValue(section)}</a>)}
      </nav>
      <section id="overview" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader><CardTitle><Sprout className="mr-2 inline h-5 w-5 text-water" />Overview</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Fact label="Species" value={project.speciesDefinition?.commonName ?? "Mixed / unknown"} />
              <Fact label="Aquarium" value={project.aquarium?.generatedName ?? project.aquarium?.name ?? "Not linked"} />
              <Fact label="Started" value={format(project.startedAt, "MMM d, yyyy")} />
              <Fact label="Graduated" value={project.graduatedItems.length} />
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.description || "No description recorded."}</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.notes || ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Edit project</CardTitle></CardHeader>
          <CardContent>
            <form action={updateBreedingProject} className="grid gap-3">
              <input type="hidden" name="projectId" value={project.id} />
              <Input name="title" defaultValue={project.title} />
              <Select name="status" defaultValue={project.status}>{breedingProjectStatuses.map((status) => <option key={status} value={status}>{humanizeBreedingValue(status)}</option>)}</Select>
              <Input name="completedAt" type="date" defaultValue={(project.completedAt ?? new Date()).toISOString().slice(0, 10)} />
              <Textarea name="description" defaultValue={project.description ?? ""} placeholder="Description" />
              <Textarea name="notes" defaultValue={project.notes ?? ""} placeholder="Notes" />
              <Button type="submit">Save project</Button>
            </form>
            {canDelete ? <form action={deleteBreedingProject} className="mt-3"><input type="hidden" name="projectId" value={project.id} /><Button type="submit" variant="secondary">Delete project</Button></form> : null}
          </CardContent>
        </Card>
      </section>
      <section id="timeline" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader><CardTitle>Project timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {project.observations.length ? project.observations.map((obs) => <div key={obs.id} className="rounded-md border border-border bg-background/55 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong className="text-primary">{obs.title || humanizeBreedingValue(obs.observationType)}</strong><span className="text-muted-foreground">{format(obs.observedAt, "MMM d, yyyy h:mm a")}</span></div><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{obs.notes}</p>{obs.cohort ? <Badge className="mt-2">{obs.cohort.name}</Badge> : null}</div>) : <Empty>No observations yet.</Empty>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Add observation</CardTitle></CardHeader>
          <CardContent><form action={addBreedingObservation} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Select name="observationType">{breedingObservationTypes.map((type) => <option key={type}>{type}</option>)}</Select><Select name="cohortId" defaultValue=""><option value="">No cohort</option>{project.cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</Select><Input name="observedAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /><Input name="title" placeholder="Optional title" /><Textarea name="notes" placeholder="Record only what you observed." required /><Button type="submit">Add observation</Button></form></CardContent>
        </Card>
      </section>
      <section id="cohorts" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>Cohorts</CardTitle></CardHeader><CardContent className="space-y-3">{project.cohorts.length ? project.cohorts.map((cohort) => <div key={cohort.id} className="rounded-md border border-border p-3"><form action={updateBreedingCohort} className="grid gap-2 sm:grid-cols-4"><input type="hidden" name="cohortId" value={cohort.id} /><strong className="sm:col-span-4 text-primary">{cohort.name}</strong><Input name="stage" defaultValue={cohort.stage} /><Input name="estimatedQuantity" defaultValue={cohort.estimatedQuantity ?? ""} placeholder="Estimate" /><Input name="currentEstimate" type="number" step="0.1" defaultValue={cohort.currentEstimate ?? ""} placeholder="Current count" /><Button type="submit" variant="secondary">Save</Button><Textarea name="notes" defaultValue={cohort.notes ?? ""} className="sm:col-span-4" /></form><form action={graduateBreedingCohort} className="mt-3 grid gap-2 sm:grid-cols-5"><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="cohortId" value={cohort.id} /><Input name="name" placeholder="Inventory name" defaultValue={cohort.name} /><Input name="quantity" type="number" step="0.1" defaultValue={cohort.currentEstimate ?? ""} /><Input name="unit" placeholder="offspring" /><Select name="aquariumId" defaultValue={cohort.destinationAquariumId ?? project.aquariumId ?? ""}><option value="">No tank</option>{aquariums.map((tank) => <option key={tank.id} value={tank.id}>{tank.generatedName ?? tank.name}</option>)}</Select><Button type="submit">Graduate</Button></form></div>) : <Empty>No cohorts yet.</Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Add cohort</CardTitle></CardHeader><CardContent><form action={addBreedingCohort} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Input name="name" placeholder="Spawn A / Batch 1" required /><Select name="quantityType">{breedingQuantityTypes.map((type) => <option key={type}>{type}</option>)}</Select><Input name="estimatedQuantity" placeholder="~30 / 20–40 / 12" /><Input name="currentEstimate" type="number" step="0.1" placeholder="Current estimate" /><Select name="stage" defaultValue={project.projectType === "PROPAGATION" ? "CUT" : "EGGS"}>{stageOptions.map((stage) => <option key={stage}>{stage}</option>)}</Select><Select name="destinationAquariumId" defaultValue={project.aquariumId ?? ""}><option value="">No destination tank</option>{aquariums.map((tank) => <option key={tank.id} value={tank.id}>{tank.generatedName ?? tank.name}</option>)}</Select><Textarea name="notes" placeholder="Cohort notes" /><Button type="submit">Add cohort</Button></form></CardContent></Card>
      </section>
      <section id="traits" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>Trait observations</CardTitle></CardHeader><CardContent className="space-y-2">{project.traitObservations.length ? project.traitObservations.map((trait) => <div key={trait.id} className="rounded-md bg-muted/45 p-3 text-sm"><strong className="text-primary">{trait.traitName}</strong>: {trait.expression}<span className="block text-xs text-muted-foreground">{humanizeBreedingValue(trait.confidence)} · {format(trait.observedAt, "MMM d, yyyy")}</span>{trait.notes ? <p className="mt-1">{trait.notes}</p> : null}</div>) : <Empty>No trait observations yet.</Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Add observed trait</CardTitle></CardHeader><CardContent><form action={addBreedingTraitObservation} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Select name="speciesTraitId" defaultValue=""><option value="">Freeform trait</option>{project.speciesDefinition?.speciesTraits.map((trait) => <option key={trait.id} value={trait.id}>{trait.name}</option>)}</Select><Input name="traitName" placeholder="Trait, e.g. color pattern" required /><Input name="expression" placeholder="Expression, e.g. blue rili" required /><Select name="confidence">{breedingTraitConfidences.map((value) => <option key={value}>{value}</option>)}</Select><Input name="observedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /><Textarea name="notes" placeholder="Observed-character notes only; no inheritance calculations." /><Button type="submit">Save trait</Button></form></CardContent></Card>
      </section>
      <section id="measurements" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>Measurements</CardTitle></CardHeader><CardContent>{project.measurements.length ? <MeasurementChart measurements={project.measurements} /> : <Empty>No measurements yet.</Empty>}<div className="mt-4 space-y-2">{project.measurements.slice(-8).reverse().map((m) => <div key={m.id} className="rounded-md bg-muted/45 p-2 text-sm"><strong>{m.metric}</strong>: {m.value} {m.unit}<span className="ml-2 text-xs text-muted-foreground">{format(m.measuredAt, "MMM d")}</span></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Add measurement</CardTitle></CardHeader><CardContent><form action={addBreedingMeasurement} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Select name="cohortId" defaultValue=""><option value="">Project-wide</option>{project.cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</Select><Input name="metric" placeholder="average length / height / leaf count" required /><Input name="value" type="number" step="0.01" required /><Input name="unit" placeholder="in / cm / count" required /><Input name="measuredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /><Textarea name="notes" /><Button type="submit">Save measurement</Button></form></CardContent></Card>
      </section>
      <section id="photos" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>Photos</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{project.photos.length ? project.photos.map((photo) => <figure key={photo.id} className="overflow-hidden rounded-md border border-border"><img src={photo.mediaAsset.thumbnailUrl ?? photo.mediaAsset.url} alt={photo.mediaAsset.altText ?? photo.caption ?? "Breeding project photo"} className="h-44 w-full object-cover" /><figcaption className="p-2 text-xs text-muted-foreground">{photo.caption ?? photo.mediaAsset.caption ?? "Project photo"}</figcaption></figure>) : <Empty>No linked photos yet.</Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Link existing photo</CardTitle></CardHeader><CardContent><form action={attachBreedingPhoto} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Select name="mediaAssetId" defaultValue=""><option value="">Choose photo</option>{mediaAssets.map((media) => <option key={media.id} value={media.id}>{media.caption ?? media.originalFilename}</option>)}</Select><Input name="caption" placeholder="Optional project caption" /><Button type="submit">Attach photo</Button></form><p className="mt-3 text-xs text-muted-foreground">Upload photos from the aquarium, inventory, condition, or timeline surfaces, then attach them here.</p></CardContent></Card>
      </section>
      <section id="goals" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>Goals</CardTitle></CardHeader><CardContent className="space-y-2">{project.goals.length ? project.goals.map((goal) => <div key={goal.id} className="rounded-md bg-muted/45 p-3 text-sm"><strong className="text-primary">{goal.goal}</strong>{goal.notes ? <p className="mt-1 text-muted-foreground">{goal.notes}</p> : null}</div>) : <Empty>No goals yet.</Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Add goal</CardTitle></CardHeader><CardContent><form action={addBreedingGoal} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Input name="goal" placeholder="Preserve locality / increase blue coloration" required /><Textarea name="notes" /><Button type="submit">Add goal</Button></form></CardContent></Card>
      </section>
      <section id="care" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>Care queue</CardTitle></CardHeader><CardContent className="space-y-2">{project.careTasks.length ? project.careTasks.map((task) => <Link href="/schedules" key={task.id} className="block rounded-md bg-muted/45 p-3 text-sm"><strong className="text-primary">{task.title}</strong><span className="block text-xs text-muted-foreground">{humanizeBreedingValue(task.status)} · due {format(task.dueAt, "MMM d, yyyy")}</span></Link>) : <Empty>No breeding care tasks yet.</Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Add care task</CardTitle></CardHeader><CardContent><form action={addBreedingCareTask} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Input name="title" placeholder="Inspect eggs / feed fry / move to grow-out" required /><Input name="dueAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /><Select name="priority" defaultValue="NORMAL"><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></Select><Textarea name="description" /><Button type="submit">Add task</Button></form></CardContent></Card>
      </section>
      <section id="workflow" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>Workflow</CardTitle></CardHeader><CardContent>{project.workflowRun ? <div className="space-y-2 text-sm"><strong className="text-primary">{project.workflowRun.workflowTemplate.name}</strong>{project.workflowRun.stepRuns.map((step) => <div key={step.id} className="rounded-md bg-muted/45 p-2">{step.workflowStep.title} · {humanizeBreedingValue(step.status)}</div>)}</div> : <Empty>No workflow attached.</Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Attach workflow</CardTitle></CardHeader><CardContent><form action={attachBreedingWorkflow} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Select name="workflowTemplateId" defaultValue=""><option value="">Choose template</option>{workflowTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select><Button type="submit" disabled={Boolean(project.workflowRunId)}>Attach workflow</Button></form></CardContent></Card>
      </section>
      <section id="summary" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card><CardHeader><CardTitle>Saved summaries</CardTitle></CardHeader><CardContent className="space-y-3">{project.summaries.length ? project.summaries.map((summary) => <div key={summary.id} className="rounded-md border border-border p-3 text-sm"><p className="whitespace-pre-wrap">{summary.summary}</p>{summary.outcomes ? <p className="mt-2 text-muted-foreground"><strong>Outcomes:</strong> {summary.outcomes}</p> : null}{summary.improvements ? <p className="mt-2 text-muted-foreground"><strong>Next time:</strong> {summary.improvements}</p> : null}</div>) : <Empty>No summaries saved yet.</Empty>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Eddy summary draft</CardTitle><p className="text-sm text-muted-foreground">Generated from saved Fluxpoint records; edit before saving.</p></CardHeader><CardContent><form action={saveBreedingSummary} className="grid gap-3"><input type="hidden" name="projectId" value={project.id} /><Textarea name="summary" defaultValue={suggestedSummary} className="min-h-48" required /><Input name="outcomes" placeholder="Outcomes" /><Input name="goalsAchieved" placeholder="Goals achieved" /><Textarea name="improvements" placeholder="Suggested improvements" /><Button type="submit">Save summary</Button></form></CardContent></Card>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md bg-muted/45 p-3"><div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 font-semibold text-primary">{value}</div></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</div>;
}

function buildSummaryDraft(project: any) {
  const lines = [
    `${project.title} is a ${humanizeBreedingValue(project.projectType)} breeding project for ${project.speciesDefinition?.commonName ?? "mixed or unknown species"}.`,
    `It has ${project.cohorts.length} cohort(s), ${project.observations.length} observation(s), ${project.traitObservations.length} observed trait record(s), and ${project.graduatedItems.length} graduated inventory record(s).`,
    project.goals.length ? `Goals: ${project.goals.map((goal: any) => goal.goal).join("; ")}.` : "No explicit goals have been recorded yet.",
    project.observations[0] ? `Latest observation: ${project.observations[0].notes}` : "No observation timeline has been recorded yet."
  ];
  return lines.join("\n\n");
}

function MeasurementChart({ measurements }: { measurements: Array<{ id: string; metric: string; value: number; measuredAt: Date; unit: string }> }) {
  const firstMetric = measurements[0]?.metric;
  const points = measurements.filter((m) => m.metric === firstMetric).slice(-12);
  const values = points.map((m) => m.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((m, index) => `${20 + index * (260 / Math.max(points.length - 1, 1))},${110 - ((m.value - min) / span) * 80}`).join(" ");
  return <div className="rounded-md border border-border bg-muted/25 p-3"><div className="mb-2 text-sm font-semibold text-primary">{firstMetric}</div><svg viewBox="0 0 320 130" className="h-40 w-full"><polyline fill="none" stroke="currentColor" strokeWidth="3" points={coords} className="text-water" /><line x1="20" y1="112" x2="300" y2="112" stroke="currentColor" className="text-muted-foreground/30" /></svg></div>;
}
