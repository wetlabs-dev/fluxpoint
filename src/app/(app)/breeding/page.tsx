import Link from "next/link";
import { Sprout } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { createBreedingProject } from "@/domains/breeding/actions";
import { breedingProjectTypes, humanizeBreedingValue } from "@/domains/breeding/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { CreatePanel } from "@/components/forms/CreatePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CreateSubmitActions } from "@/components/forms/CreateSubmitActions";

export const dynamic = "force-dynamic";

export default async function BreedingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const params = await searchParams;
  const status = params.status === "COMPLETED" ? "COMPLETED" : params.status === "ALL" ? undefined : "ACTIVE";
  const defaultAquariumId = params.aquariumId ?? "";
  const [projects, species, aquariums, activeCount, completedCount] = await Promise.all([
    prisma.breedingProject.findMany({
      where: { collectionId: collection.id, ...(status ? { status } : {}) },
      include: { speciesDefinition: true, aquarium: true, cohorts: true, observations: { orderBy: { observedAt: "desc" }, take: 1 }, goals: true },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }]
    }),
    prisma.speciesDefinition.findMany({ where: { OR: [{ collectionId: collection.id }, { collectionId: null }] }, orderBy: [{ category: "asc" }, { commonName: "asc" }], take: 200 }),
    prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    prisma.breedingProject.count({ where: { collectionId: collection.id, status: { in: ["PLANNING", "ACTIVE", "PAUSED"] } } }),
    prisma.breedingProject.count({ where: { collectionId: collection.id, status: "COMPLETED" } })
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Breeding" eyebrow="Projects, cohorts, observations">
        <div className="flex flex-wrap gap-2">
          <Badge>{activeCount} active</Badge>
          <Badge>{completedCount} completed</Badge>
          <Link href="/breeding/reports"><Button variant="secondary">Reports</Button></Link>
        </div>
      </PageHeader>
      <CreatePanel title="New breeding project" icon={<Sprout className="h-5 w-5 text-water" />} defaultOpen={Boolean(params.create || defaultAquariumId)}>
        <form action={createBreedingProject} className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium"><span>Title</span><Input name="title" placeholder="Kivuli shell-dweller spawn" required /></label>
          <label className="grid gap-1 text-sm font-medium"><span>Project type</span><Select name="projectType" defaultValue="MANAGED">{breedingProjectTypes.map((type) => <option key={type} value={type}>{humanizeBreedingValue(type)}</option>)}</Select></label>
          <label className="grid gap-1 text-sm font-medium"><span>Species</span><Select name="speciesDefinitionId" defaultValue=""><option value="">No species yet</option>{species.map((entry) => <option key={entry.id} value={entry.id}>{entry.commonName} · {entry.category}</option>)}</Select></label>
          <label className="grid gap-1 text-sm font-medium"><span>Aquarium</span><Select name="aquariumId" defaultValue={defaultAquariumId}><option value="">No aquarium</option>{aquariums.map((tank) => <option key={tank.id} value={tank.id}>{tank.generatedName ?? tank.name}</option>)}</Select></label>
          <label className="grid gap-1 text-sm font-medium"><span>Start date</span><Input name="startedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><input name="createInitialCohort" type="checkbox" defaultChecked /> Create an initial cohort</label>
          <label className="grid gap-1 text-sm font-medium"><span>Cohort name</span><Input name="cohortName" placeholder="Spawn A / Batch 1 / Spring cuttings" /></label>
          <label className="grid gap-1 text-sm font-medium"><span>Initial stage</span><Input name="stage" placeholder="PAIRING, EGGS, BORN, CUT..." /></label>
          <label className="grid gap-1 text-sm font-medium lg:col-span-2"><span>Description</span><Textarea name="description" placeholder="What are you trying to document or accomplish?" /></label>
          <label className="grid gap-1 text-sm font-medium lg:col-span-2"><span>Notes</span><Textarea name="notes" placeholder="Observed context, setup, caveats, or community-tank notes." /></label>
          <CreateSubmitActions label="Create project" cancelHref="/breeding" className="lg:col-span-2" />
        </form>
      </CreatePanel>
      <div className="flex flex-wrap gap-2">
        <Link href="/breeding"><Button variant={status === "ACTIVE" ? "primary" : "secondary"}>Active Projects</Button></Link>
        <Link href="/breeding?status=COMPLETED"><Button variant={status === "COMPLETED" ? "primary" : "secondary"}>Completed Projects</Button></Link>
        <Link href="/breeding?status=ALL"><Button variant={!status ? "primary" : "secondary"}>All Projects</Button></Link>
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        {projects.length ? projects.map((project) => (
          <Link key={project.id} href={`/breeding/${project.id}`} className="block">
            <Card className="h-full transition hover:border-primary/45">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle>{project.title}</CardTitle><p className="text-sm text-muted-foreground">{project.speciesDefinition?.commonName ?? "Mixed or unknown species"} · {project.aquarium?.generatedName ?? project.aquarium?.name ?? "No aquarium"}</p></div>
                  <Badge>{humanizeBreedingValue(project.projectType)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="grid grid-cols-3 gap-2">
                  <Fact label="Status" value={humanizeBreedingValue(project.status)} />
                  <Fact label="Cohorts" value={project.cohorts.length} />
                  <Fact label="Goals" value={project.goals.length} />
                </div>
                <p className="line-clamp-2">{project.description || project.notes || "No project notes yet."}</p>
                <p className="text-xs">{project.observations[0] ? `Latest: ${project.observations[0].observedAt.toLocaleDateString()} · ${humanizeBreedingValue(project.observations[0].observationType)}` : "No observations yet."}</p>
              </CardContent>
            </Card>
          </Link>
        )) : <Card className="lg:col-span-2"><CardContent className="p-8 text-center text-sm text-muted-foreground">No breeding projects match this view.</CardContent></Card>}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md bg-muted/45 p-3"><div className="text-xs uppercase tracking-[0.14em]">{label}</div><div className="mt-1 font-semibold text-primary">{value}</div></div>;
}
