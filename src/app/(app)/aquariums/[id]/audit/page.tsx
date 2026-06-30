import Link from "next/link";
import { format } from "date-fns";
import { ClipboardCheck, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionRole } from "@/domains/auth/permissions";
import { activeAuditWhere, canFinalizeTankAudit, getAquariumAuditIndex } from "@/domains/tank-audits/tank-audit-service";
import { startTankAuditAction } from "@/domains/tank-audits/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function AquariumAuditIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const [aquarium, role] = await Promise.all([
    prisma.aquarium.findFirst({ where: { id, collectionId: collection.id } }),
    getCollectionRole(user.id, collection.id)
  ]);
  if (!aquarium) notFound();
  const [audits, active] = await Promise.all([
    getAquariumAuditIndex({ collectionId: collection.id, aquariumId: id }),
    prisma.tankAuditSession.findFirst({ where: activeAuditWhere(collection.id, id), orderBy: { openedAt: "desc" } })
  ]);
  const canStart = canFinalizeTankAudit(role);
  return <div className="space-y-6">
    <PageHeader title="Tank Audits" eyebrow={aquarium.generatedName ?? aquarium.name}>
      <Link href={`/aquariums/${id}`} className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">Back to aquarium</Link>
    </PageHeader>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-water" /> Operational inventory true-up</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Tank Audits snapshot the current aquarium inventory, produce a printable worksheet, and let you reconcile observed contents before applying any inventory changes.</p>
        {active ? <Link href={`/aquariums/${id}/audit/${active.id}`}><Button>Continue active audit</Button></Link> : canStart ? (
          <form action={startTankAuditAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="aquariumId" value={id} />
            <Input name="title" placeholder="Optional audit title" />
            <Button type="submit">Start tank audit</Button>
          </form>
        ) : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Aquarist access is required to start a tank audit.</p>}
      </CardContent>
    </Card>
    <section className="grid gap-4">
      {audits.length ? audits.map((audit) => (
        <Card key={audit.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><strong className="text-primary">{audit.title ?? "Tank audit"}</strong><Badge>{audit.status}</Badge><Badge>{audit._count.lines} lines</Badge></div>
              <p className="mt-1 text-sm text-muted-foreground">Opened {format(audit.openedAt, "MMM d, yyyy h:mm a")} by {audit.openedBy?.name ?? audit.openedBy?.email ?? "Unknown"}{audit.finalizedAt ? ` · finalized ${format(audit.finalizedAt, "MMM d, yyyy")}` : ""}</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/aquariums/${id}/audit/${audit.id}`}><Button variant="secondary">{audit.status === "FINALIZED" ? "View audit" : "Open workspace"}</Button></Link>
              <a href={`/aquariums/${id}/audit/${audit.id}/worksheet`} target="_blank" rel="noreferrer"><Button variant="ghost"><FileText className="mr-2 h-4 w-4" />Worksheet</Button></a>
            </div>
          </CardContent>
        </Card>
      )) : <Card><CardContent className="p-8 text-center text-muted-foreground">No tank audits yet.</CardContent></Card>}
    </section>
  </div>;
}
