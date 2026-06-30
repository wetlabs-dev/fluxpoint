import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { humanizeBreedingValue } from "@/domains/breeding/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BreedingReportsPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const [projects, traitRows] = await Promise.all([
    prisma.breedingProject.findMany({
      where: { collectionId: collection.id },
      include: { speciesDefinition: true, cohorts: true, graduatedItems: true, observations: true, traitObservations: true },
      orderBy: { startedAt: "desc" }
    }),
    prisma.breedingTraitObservation.groupBy({ by: ["traitName", "expression"], where: { collectionId: collection.id }, _count: { _all: true }, orderBy: { _count: { traitName: "desc" } }, take: 12 })
  ]);
  const bySpecies = new Map<string, number>();
  const byYear = new Map<string, number>();
  for (const project of projects) {
    bySpecies.set(project.speciesDefinition?.commonName ?? "Mixed / unknown", (bySpecies.get(project.speciesDefinition?.commonName ?? "Mixed / unknown") ?? 0) + 1);
    byYear.set(String(project.startedAt.getFullYear()), (byYear.get(String(project.startedAt.getFullYear())) ?? 0) + 1);
  }
  const active = projects.filter((project) => ["PLANNING", "ACTIVE", "PAUSED"].includes(project.status));
  const completed = projects.filter((project) => project.status === "COMPLETED");
  const totalGraduated = projects.reduce((sum, project) => sum + project.graduatedItems.reduce((inner, item) => inner + item.quantity, 0), 0);
  const cohortCount = projects.reduce((sum, project) => sum + project.cohorts.length, 0);
  const averageCohortSize = cohortCount ? Math.round((totalGraduated / cohortCount) * 10) / 10 : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Breeding Reports" eyebrow="Outcomes and observed traits">
        <Link href="/breeding"><Button variant="secondary">Back to breeding</Button></Link>
      </PageHeader>
      <section className="grid gap-4 md:grid-cols-4">
        <Fact label="Active projects" value={active.length} />
        <Fact label="Completed" value={completed.length} />
        <Fact label="Avg graduated/cohort" value={averageCohortSize} />
        <Fact label="Observed traits" value={traitRows.length} />
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <ReportCard title="Projects by species" rows={[...bySpecies.entries()]} />
        <ReportCard title="Projects by year" rows={[...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]))} />
        <Card>
          <CardHeader><CardTitle>Current active projects</CardTitle></CardHeader>
          <CardContent className="space-y-2">{active.length ? active.map((project) => <ProjectRow key={project.id} project={project} />) : <Empty>No active breeding projects.</Empty>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Completed projects</CardTitle></CardHeader>
          <CardContent className="space-y-2">{completed.length ? completed.slice(0, 10).map((project) => <ProjectRow key={project.id} project={project} />) : <Empty>No completed projects yet.</Empty>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Trait frequency</CardTitle></CardHeader>
          <CardContent className="space-y-2">{traitRows.length ? traitRows.map((row) => <div key={`${row.traitName}-${row.expression}`} className="flex justify-between rounded-md bg-muted/45 p-3 text-sm"><span><strong className="text-primary">{row.traitName}</strong>: {row.expression}</span><Badge>{row._count._all}</Badge></div>) : <Empty>No trait observations yet.</Empty>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Success history</CardTitle></CardHeader>
          <CardContent className="space-y-2">{projects.filter((project) => project.graduatedItems.length).length ? projects.filter((project) => project.graduatedItems.length).map((project) => <div key={project.id} className="rounded-md bg-muted/45 p-3 text-sm"><Link href={`/breeding/${project.id}`} className="font-semibold text-primary underline">{project.title}</Link><span className="block text-muted-foreground">{project.graduatedItems.reduce((sum, item) => sum + item.quantity, 0)} graduated to inventory</span></div>) : <Empty>No cohorts graduated yet.</Empty>}</CardContent>
        </Card>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-2xl font-semibold text-primary">{value}</div></CardContent></Card>;
}

function ReportCard({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.length ? rows.map(([label, count]) => <div key={label} className="flex justify-between rounded-md bg-muted/45 p-3 text-sm"><span>{label}</span><Badge>{count}</Badge></div>) : <Empty>No report rows yet.</Empty>}</CardContent></Card>;
}

function ProjectRow({ project }: { project: { id: string; title: string; status: string; speciesDefinition: { commonName: string } | null; observations: unknown[]; cohorts: unknown[] } }) {
  return <Link href={`/breeding/${project.id}`} className="block rounded-md bg-muted/45 p-3 text-sm"><strong className="text-primary">{project.title}</strong><span className="block text-muted-foreground">{project.speciesDefinition?.commonName ?? "Mixed / unknown"} · {humanizeBreedingValue(project.status)} · {project.cohorts.length} cohort(s) · {project.observations.length} observation(s)</span></Link>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</div>;
}
