import Link from "next/link";
import { format } from "date-fns";
import { BrainCircuit } from "lucide-react";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionIntelligenceSummary } from "@/domains/aquarium-intelligence/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CollectionIntelligencePage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const rows = await getCollectionIntelligenceSummary(collection.id);
  const urgent = rows.filter((row) => row.priority === "urgent").length;
  const review = rows.filter((row) => ["review soon", "review"].includes(row.priority)).length;
  const stale = rows.filter((row) => row.stale).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Aquarium Intelligence" eyebrow="Collection health">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-card text-primary">{urgent} urgent</Badge>
          <Badge className="bg-card text-primary">{review} review</Badge>
          <Badge className="bg-card text-primary">{stale} stale</Badge>
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-water" /> Tanks needing attention</CardTitle>
          <p className="text-sm text-muted-foreground">Priority is qualitative. Fluxpoint does not rank aquariums with false precision.</p>
        </CardHeader>
        <CardContent className="grid gap-3">
          {rows.length ? rows.map((row) => (
            <Link key={row.aquariumId} href={`/aquariums/${row.aquariumId}?workspace=intelligence#workspace`} className="rounded-md border border-border bg-background/60 p-4 transition hover:bg-muted/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-primary">{row.aquariumName}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <span className="capitalize">{row.priority}</span>
                    {row.assessment ? <> · {row.assessment.healthState.toLowerCase().replaceAll("_", " ")} · {row.assessment.confidence.toLowerCase()} confidence</> : <> · no assessment yet</>}
                    {row.stale ? <> · refresh available</> : null}
                  </div>
                </div>
                {row.assessment ? <Badge>{format(row.assessment.assessedAt, "MMM d")}</Badge> : <Badge>Not assessed</Badge>}
              </div>
              {row.parameterAnalyses.length ? <p className="mt-2 text-sm text-muted-foreground">{row.parameterAnalyses.map((analysis) => `${analysis.metricKey}: ${analysis.concernState.toLowerCase()}`).join(" · ")}</p> : null}
              {row.timelineInsights[0] ? <p className="mt-2 text-sm">{row.timelineInsights[0].title}</p> : null}
            </Link>
          )) : <p className="text-sm text-muted-foreground">No active aquariums found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
