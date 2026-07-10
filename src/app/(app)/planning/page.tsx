import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateAquariumPlanProgress } from "@/domains/aquarium-plans/progress";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const plans = await prisma.aquariumPlan.findMany({
    where: { collectionId: collection.id },
    include: { aquarium: true, items: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });
  const active = plans.filter((plan) => ["ACTIVE", "DRAFT", "PAUSED", "READY_TO_COMPLETE"].includes(plan.status));
  const completed = plans.filter((plan) => ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(plan.status));
  const blockedItems = plans.reduce((sum, plan) => sum + plan.items.filter((item) => item.status === "BLOCKED").length, 0);
  const readyPlans = active.filter((plan) => calculateAquariumPlanProgress(plan.items).readyToComplete);

  return (
    <div className="space-y-5">
      <PageHeader title="Tank Planning" eyebrow="Future state, staged safely">
        <Badge>{active.length} active plan{active.length === 1 ? "" : "s"}</Badge>
      </PageHeader>
      <section className="grid gap-4 md:grid-cols-4">
        <Summary label="Planning tanks" value={plans.filter((plan) => plan.planType === "INITIAL_SETUP" && !["COMPLETED", "CANCELLED", "ARCHIVED"].includes(plan.status)).length} />
        <Summary label="Active revisions" value={plans.filter((plan) => plan.planType === "REVISION" && !["COMPLETED", "CANCELLED", "ARCHIVED"].includes(plan.status)).length} />
        <Summary label="Blocked items" value={blockedItems} />
        <Summary label="Ready to complete" value={readyPlans.length} />
      </section>
      <Card>
        <CardHeader><CardTitle>Active planning work</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {active.length ? active.map((plan) => <PlanRow key={plan.id} plan={plan} />) : <p className="text-sm text-muted-foreground">No active tank plans yet. Create a PLANNING aquarium or start a revision from an active aquarium.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Plan history</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {completed.length ? completed.slice(0, 20).map((plan) => <PlanRow key={plan.id} plan={plan} />) : <p className="text-sm text-muted-foreground">Completed, cancelled, and archived plans will remain here as history.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanRow({ plan }: { plan: any }) {
  const progress = calculateAquariumPlanProgress(plan.items);
  return (
    <Link href={`/aquariums/${plan.aquariumId}/plans/${plan.id}`} className="rounded-lg border border-border bg-card/75 p-4 transition hover:border-water/50 hover:bg-muted/35">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-primary">{plan.title}</div>
          <div className="text-sm text-muted-foreground">{plan.aquarium.name} · {plan.planType.toLowerCase().replaceAll("_", " ")}</div>
        </div>
        <div className="flex flex-wrap gap-2"><Badge>{plan.status.toLowerCase().replaceAll("_", " ")}</Badge><Badge>{progress.percent}%</Badge></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-water" style={{ width: `${progress.percent}%` }} /></div>
      <p className="mt-2 text-xs text-muted-foreground">{progress.requiredRemaining} required remaining · {progress.optionalRemaining} optional remaining</p>
    </Link>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-2 font-mono text-3xl font-semibold text-primary">{value}</div></CardContent></Card>;
}
