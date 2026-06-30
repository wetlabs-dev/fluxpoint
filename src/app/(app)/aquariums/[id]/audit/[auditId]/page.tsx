import Link from "next/link";
import { format } from "date-fns";
import { ClipboardCheck, FileText, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import type { TankAuditLineStatus } from "@prisma/client";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionRole } from "@/domains/auth/permissions";
import { addFoundExtraAuditLineAction, cancelTankAuditAction, finalizeTankAuditAction, updateTankAuditLineAction } from "@/domains/tank-audits/actions";
import { auditGroupForItemType, canCancelTankAudit, canEditTankAudit, canFinalizeTankAudit, getTankAuditSessionForView } from "@/domains/tank-audits/tank-audit-service";
import { formatFishSexBreakdown } from "@/domains/inventory/fish-sex";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

const statuses: TankAuditLineStatus[] = ["PENDING", "CONFIRMED", "ADJUST", "MISSING", "REMOVE", "MAINTENANCE_NEEDED", "CONDITION_NOTED", "NO_CHANGE"];
const itemTypes = ["FISH", "INVERT", "PLANT", "SUBSTRATE", "HARDSCAPE", "EQUIPMENT", "BOTANICAL", "FOOD", "MEDICATION", "ADDITIVE", "OTHER"];

export default async function TankAuditWorkspacePage({ params }: { params: Promise<{ id: string; auditId: string }> }) {
  const { id, auditId } = await params;
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const role = await getCollectionRole(user.id, collection.id);
  if (!role) notFound();
  const session = await getTankAuditSessionForView({ collectionId: collection.id, aquariumId: id, auditId }).catch(() => null);
  if (!session) notFound();
  const editable = ["OPEN", "IN_PROGRESS"].includes(session.status) && canEditTankAudit(role);
  const canFinalize = ["OPEN", "IN_PROGRESS"].includes(session.status) && canFinalizeTankAudit(role);
  const canCancel = ["OPEN", "IN_PROGRESS"].includes(session.status) && canCancelTankAudit(role);
  const grouped = new Map<string, typeof session.lines>();
  for (const line of session.lines) grouped.set(auditGroupForItemType(line.itemType), [...(grouped.get(auditGroupForItemType(line.itemType)) ?? []), line]);
  const summary = summarize(session.lines);
  return <div className="space-y-6">
    <PageHeader title={session.title ?? "Tank Audit"} eyebrow={session.aquarium.generatedName ?? session.aquarium.name}>
      <Link href={`/aquariums/${id}/audit`} className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">Audit history</Link>
    </PageHeader>
    <Card>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Badge>{session.status}</Badge><Badge>{session.lines.length} lines</Badge><Badge>{summary.pending} pending</Badge><Badge>{summary.actionable} action(s)</Badge></div>
          <p className="mt-2 text-sm text-muted-foreground">Opened {format(session.openedAt, "MMM d, yyyy h:mm a")} by {session.openedBy?.name ?? session.openedBy?.email ?? "Unknown"}. Draft line edits do not change inventory until you finalize.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/aquariums/${id}/audit/${auditId}/worksheet`} target="_blank" rel="noreferrer"><Button variant="secondary"><FileText className="mr-2 h-4 w-4" />Download worksheet</Button></a>
          {canFinalize ? <form action={finalizeTankAuditAction}><input type="hidden" name="aquariumId" value={id} /><input type="hidden" name="auditId" value={auditId} /><Button type="submit"><ClipboardCheck className="mr-2 h-4 w-4" />Finalize audit</Button></form> : null}
          {canCancel ? <form action={cancelTankAuditAction}><input type="hidden" name="aquariumId" value={id} /><input type="hidden" name="auditId" value={auditId} /><Button type="submit" variant="ghost">Cancel</Button></form> : null}
        </div>
      </CardContent>
    </Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Fact label="Confirmed" value={summary.confirmed} />
      <Fact label="Adjustments" value={summary.adjust} />
      <Fact label="Missing/remove" value={summary.remove} />
      <Fact label="Maintenance" value={summary.maintenance} />
      <Fact label="Conditions" value={summary.conditions} />
    </div>
    {canFinalize ? <ReviewSummary summary={summary} /> : null}
    <section className="space-y-6">
      {Array.from(grouped.entries()).map(([group, lines]) => (
        <Card key={group}>
          <CardHeader><CardTitle>{group}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {lines.map((line) => <AuditLineCard key={line.id} line={line} aquariumId={id} auditId={auditId} editable={editable} />)}
          </CardContent>
        </Card>
      ))}
    </section>
    {editable ? <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-water" /> Found extra item</CardTitle></CardHeader>
      <CardContent>
        <form action={addFoundExtraAuditLineAction} className="grid gap-3 md:grid-cols-[10rem_1fr_8rem]">
          <input type="hidden" name="aquariumId" value={id} /><input type="hidden" name="auditId" value={auditId} />
          <Select name="itemType" defaultValue="FISH">{itemTypes.map((type) => <option key={type} value={type}>{type}</option>)}</Select>
          <Input name="itemName" placeholder="Name or species observed" />
          <Input name="observedQuantity" type="number" min="0" step="0.1" defaultValue="1" />
          <Textarea name="notes" placeholder="Notes from inspection" className="md:col-span-3" />
          <Button type="submit" className="md:col-span-3">Add found-extra line</Button>
        </form>
      </CardContent>
    </Card> : null}
  </div>;
}

function AuditLineCard({ line, aquariumId, auditId, editable }: { line: any; aquariumId: string; auditId: string; editable: boolean }) {
  const expected = line.expectedQuantity ?? "—";
  const fishBreakdown = line.itemType === "FISH" ? formatFishSexBreakdown({ itemType: "FISH", quantity: line.observedQuantity ?? line.expectedQuantity ?? 0, maleCountApprox: line.maleCountApprox, femaleCountApprox: line.femaleCountApprox }) : null;
  return <div className="rounded-lg border border-border bg-background/55 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2"><strong className="text-primary">{line.itemName}</strong><Badge>{line.itemType}</Badge><Badge>{line.status}</Badge></div>
        <p className="mt-1 text-sm text-muted-foreground">{line.speciesDefinition?.scientificName ?? line.speciesDefinition?.commonName ?? "No linked species"} · expected {expected}{line.aquariumItem?.unit ? ` ${line.aquariumItem.unit}` : ""}{fishBreakdown ? ` · ${fishBreakdown}` : ""}</p>
      </div>
      {line.aquariumItemId ? <Link href={`/inventory/${line.aquariumItemId}`} className="text-sm font-semibold text-primary underline">Open item</Link> : null}
    </div>
    {editable ? <form action={updateTankAuditLineAction} className="mt-4 grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} /><input type="hidden" name="auditId" value={auditId} /><input type="hidden" name="lineId" value={line.id} />
      <div className="grid gap-3 md:grid-cols-[12rem_8rem_8rem_8rem]">
        <label className="grid gap-1"><span className="text-xs font-semibold text-muted-foreground">Status</span><Select name="status" defaultValue={line.status}>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ").toLowerCase()}</option>)}</Select></label>
        <label className="grid gap-1"><span className="text-xs font-semibold text-muted-foreground">Observed qty</span><Input name="observedQuantity" type="number" min="0" step="0.1" defaultValue={line.observedQuantity ?? line.expectedQuantity ?? ""} /></label>
        {line.itemType === "FISH" ? <><label className="grid gap-1"><span className="text-xs font-semibold text-muted-foreground">Male</span><Input name="maleCountApprox" type="number" min="0" step="1" defaultValue={line.maleCountApprox ?? ""} /></label><label className="grid gap-1"><span className="text-xs font-semibold text-muted-foreground">Female</span><Input name="femaleCountApprox" type="number" min="0" step="1" defaultValue={line.femaleCountApprox ?? ""} /></label></> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Textarea name="notes" placeholder="Audit notes" defaultValue={line.notes ?? ""} />
        {line.itemType === "EQUIPMENT" ? <Textarea name="maintenanceNotes" placeholder="Maintenance or issue notes" defaultValue={line.maintenanceNotes ?? ""} /> : line.itemType === "PLANT" ? <Textarea name="growthNotes" placeholder="Growth / melt / spread notes" defaultValue={line.growthNotes ?? ""} /> : <Textarea name="healthNotes" placeholder="Health notes" defaultValue={line.healthNotes ?? ""} />}
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground"><input name="createCondition" type="checkbox" defaultChecked={line.createCondition} /> Create condition from notes on finalize</label>
      <div className="flex flex-wrap gap-2"><Button type="submit">Save line</Button><QuickSave line={line} status="CONFIRMED" label="Confirm" /><QuickSave line={line} status="ADJUST" label="Adjust quantity" /><QuickSave line={line} status="MISSING" label="Mark missing" /><QuickSave line={line} status="REMOVE" label={line.itemType === "EQUIPMENT" ? "Detach/remove" : "Remove from tank"} /></div>
    </form> : <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p>Observed: {line.observedQuantity ?? "—"}</p><p>{line.notes || line.healthNotes || line.growthNotes || line.maintenanceNotes || "No notes recorded."}</p></div>}
  </div>;
}

function QuickSave({ line, status, label }: { line: any; status: string; label: string }) {
  return <button name="quickStatus" value={status} className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/70">{label}</button>;
}

function Fact({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-2xl font-semibold text-primary">{value}</div></CardContent></Card>;
}

function summarize(lines: any[]) {
  return lines.reduce((acc, line) => {
    acc.pending += line.status === "PENDING" ? 1 : 0;
    acc.confirmed += ["CONFIRMED", "NO_CHANGE"].includes(line.status) ? 1 : 0;
    acc.adjust += line.status === "ADJUST" ? 1 : 0;
    acc.remove += ["MISSING", "REMOVE"].includes(line.status) ? 1 : 0;
    acc.maintenance += line.status === "MAINTENANCE_NEEDED" || Boolean(line.maintenanceNotes) ? 1 : 0;
    acc.conditions += line.status === "CONDITION_NOTED" || line.createCondition ? 1 : 0;
    acc.created += line.status === "FOUND_EXTRA" ? 1 : 0;
    acc.actionable += !["PENDING", "CONFIRMED", "NO_CHANGE"].includes(line.status) ? 1 : 0;
    return acc;
  }, { pending: 0, confirmed: 0, adjust: 0, remove: 0, maintenance: 0, conditions: 0, created: 0, actionable: 0 });
}

function ReviewSummary({ summary }: { summary: ReturnType<typeof summarize> }) {
  return <Card className="border-water/40">
    <CardHeader><CardTitle>Finalize review</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">
      Finalizing will apply {summary.adjust} quantity adjustment(s), remove or mark missing {summary.remove} line(s), create {summary.created} found-extra item(s), and record {summary.maintenance + summary.conditions} maintenance/condition note(s). Pending lines are left unchanged.
    </CardContent>
  </Card>;
}
