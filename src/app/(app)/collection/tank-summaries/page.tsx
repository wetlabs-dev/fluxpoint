import Link from "next/link";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TankSummaryPanel } from "@/components/summaries/TankSummaryPanel";
import {
  buildCollectionTankSummaryData,
  formatCollectionSummaryMarkdown,
  formatCollectionSummaryPlainText
} from "@/domains/summaries/tank-summary";

export const dynamic = "force-dynamic";

export default async function CollectionTankSummariesPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const summary = await buildCollectionTankSummaryData(collection.id);
  const texts = {
    compact: {
      plain: formatCollectionSummaryPlainText(summary, "compact"),
      markdown: formatCollectionSummaryMarkdown(summary, "compact")
    },
    standard: {
      plain: formatCollectionSummaryPlainText(summary, "standard"),
      markdown: formatCollectionSummaryMarkdown(summary, "standard")
    },
    detailed: {
      plain: formatCollectionSummaryPlainText(summary, "detailed"),
      markdown: formatCollectionSummaryMarkdown(summary, "detailed")
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tank summaries" eyebrow="Collection export">
        <Link href="/collection" className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Back to collection</Link>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>{summary.collection.name}</CardTitle>
          <p className="text-sm text-muted-foreground">A compact, deterministic snapshot of every aquarium in this collection. No IDs, prices, user emails, audit logs, or server data are included.</p>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <Info label="Tanks" value={`${summary.collection.tankCount}`} />
          <Info label="Total volume" value={summary.collection.totalVolumeGallons != null ? `${summary.collection.totalVolumeGallons.toFixed(1).replace(/\.0$/, "")} gal` : "Not recorded"} />
          <Info label="Fish" value={`${summary.collection.totalFish}`} />
          <Info label="Plants" value={`${summary.collection.totalPlants}`} />
          <Info label="Open conditions" value={`${summary.collection.totalOpenConditions}`} />
        </CardContent>
      </Card>
      <TankSummaryPanel
        title="Summarize all tanks"
        description="Switch between compact, standard, and detailed versions, then copy or download."
        filenameBase={`${collection.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection"}-tank-summaries`}
        texts={texts}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-primary">{value}</div>
    </div>
  );
}
