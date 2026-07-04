import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, CalendarClock, Camera, ClipboardPlus, Pill } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionRole } from "@/domains/auth/permissions";
import { addConditionObservation, archiveCondition, linkMedicationCourse, updateConditionPlan } from "@/domains/conditions/actions";
import { conditionLabel, conditionSeverities, conditionStatuses } from "@/domains/conditions/condition-catalog";
import { ConditionBadge } from "@/components/conditions/ConditionBadge";
import { EddyConditionAssistant } from "@/components/conditions/EddyConditionAssistant";
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaUploadButton } from "@/components/media/MediaUploadButton";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { formatDateTimeInTimeZone, formatDateTimeLocalInput, userTimeZone } from "@/lib/dates/user-timezone";

export const dynamic = "force-dynamic";

export default async function ConditionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const timeZone = userTimeZone(user);
  const role = await getCollectionRole(user.id, collection.id);
  const { id } = await params;
  const condition = await prisma.healthCondition.findFirst({
    where: { id, collectionId: collection.id },
    include: {
      aquarium: true, createdBy: true, updatedBy: true,
      observations: { include: { createdBy: true }, orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }] },
      careTasks: { include: { careSchedule: true }, orderBy: { dueAt: "desc" } },
      medicationCourses: { include: { medicationDefinition: true, doseEvents: true }, orderBy: { startedAt: "desc" } },
      aquariumEvents: { orderBy: { eventDate: "desc" }, take: 20 },
      mediaAssets: { orderBy: { createdAt: "desc" } },
      links: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!condition) notFound();
  const canObserve = role !== "VIEWER";
  const canEdit = role === "COLLECTION_OWNER" || role === "AQUARIST";
  const medicationCourses = condition.aquariumId ? await prisma.medicationCourse.findMany({ where: { collectionId: collection.id, aquariumId: condition.aquariumId, OR: [{ relatedConditionId: null }, { relatedConditionId: condition.id }] }, include: { medicationDefinition: true }, orderBy: { startedAt: "desc" } }) : [];
  const entity = condition.entityId ? await entityLabel(collection.id, condition.entityType, condition.entityId) : null;
  return (
    <div className="space-y-6">
      <PageHeader title={condition.title} eyebrow="Condition record"><div className="flex flex-wrap gap-2"><ConditionBadge value={condition.status} /><ConditionBadge value={condition.severity} kind="severity" /><ConditionBadge value={condition.category} kind="category" /></div></PageHeader>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><Link className="font-semibold text-primary underline" href="/conditions">All conditions</Link>{condition.aquarium ? <Link className="font-semibold text-primary underline" href={`/aquariums/${condition.aquarium.id}?workspace=conditions`}>{condition.aquarium.name}</Link> : <span>Collection-wide</span>}<span>{condition.conditionType}</span>{entity ? <span>{entity}</span> : null}</div>
      <section className="grid gap-5 lg:grid-cols-4"><Fact label="First observed" value={formatDateTimeInTimeZone(condition.firstObservedAt, timeZone)} /><Fact label="Last observed" value={condition.lastObservedAt ? formatDateTimeInTimeZone(condition.lastObservedAt, timeZone) : "Not updated"} /><Fact label="Affected" value={condition.affectedCount === null ? "Not counted" : `${condition.affectedCount} ${condition.affectedCountLabel ?? "affected"}`} /><Fact label="Follow-ups" value={`${condition.careTasks.filter((task) => task.status === "PENDING").length} open`} /></section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Observations</CardTitle></CardHeader><CardContent className="space-y-3">{condition.observations.length ? condition.observations.map((observation) => <article key={observation.id} className="rounded-md border border-border bg-background/55 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-mono text-xs text-muted-foreground">{formatDateTimeInTimeZone(observation.observedAt, timeZone)} · {observation.createdBy?.name ?? "Unknown keeper"}</div><div className="flex gap-2">{observation.status ? <ConditionBadge value={observation.status} /> : null}{observation.severity ? <ConditionBadge value={observation.severity} kind="severity" /> : null}</div></div><p className="mt-2 whitespace-pre-wrap text-sm">{observation.notes}</p>{observation.affectedCount !== null ? <div className="mt-2 text-xs text-muted-foreground">Affected count: {observation.affectedCount}</div> : null}</article>) : <Empty text="No progress observations yet." />}</CardContent></Card>
          <Card><CardHeader><CardTitle><Camera className="mr-2 inline h-5 w-5" />Photos</CardTitle></CardHeader><CardContent className="space-y-4">{condition.aquariumId && canObserve ? <MediaUploadButton aquariumId={condition.aquariumId} conditionId={condition.id} /> : null}{condition.mediaAssets.length ? <MediaGallery assets={condition.mediaAssets as never} /> : <Empty text="No condition photos yet. Moderated uploads retain their review state." />}</CardContent></Card>
        <Card><CardHeader><CardTitle><Pill className="mr-2 inline h-5 w-5" />Treatment context</CardTitle></CardHeader><CardContent className="space-y-3">{condition.medicationCourses.length ? condition.medicationCourses.map((course) => <div key={course.id} className="rounded-md bg-muted/45 p-3"><div className="font-semibold text-primary">{course.title}</div><div className="text-sm text-muted-foreground">{course.medicationDefinition.name} · {conditionLabel(course.status)} · {course.doseEvents.length} dose events</div></div>) : <Empty text="No medication course is linked. Linking records context; Fluxpoint does not prescribe treatment." />}{canEdit && medicationCourses.length ? <form action={linkMedicationCourse} className="flex gap-2"><input type="hidden" name="conditionId" value={condition.id} /><Select name="medicationCourseId"><option value="">Choose aquarium medication course</option>{medicationCourses.map((course) => <option key={course.id} value={course.id}>{course.title} · {course.medicationDefinition.name}</option>)}</Select><Button type="submit" variant="secondary">Link</Button></form> : condition.aquariumId ? <Link className="text-sm font-semibold text-primary underline" href={`/aquariums/${condition.aquariumId}?workspace=schedules&conditionId=${condition.id}#medication-form`}>Start a linked course from the aquarium workspace</Link> : null}</CardContent></Card>
        </div>
        <div className="space-y-6">
          {canObserve && condition.status !== "ARCHIVED" ? <Card><CardHeader><CardTitle><ClipboardPlus className="mr-2 inline h-5 w-5" />Add observation</CardTitle></CardHeader><CardContent><form action={addConditionObservation} className="grid gap-3"><input type="hidden" name="conditionId" value={condition.id} /><Input name="observedAt" type="datetime-local" defaultValue={formatDateTimeLocalInput(new Date(), timeZone)} />{canEdit ? <div className="grid grid-cols-2 gap-3"><Select name="status" defaultValue=""><option value="">Keep {conditionLabel(condition.status)}</option>{conditionStatuses.filter((status) => status !== "ARCHIVED").map((status) => <option key={status} value={status}>{conditionLabel(status)}</option>)}</Select><Select name="severity" defaultValue=""><option value="">Keep {conditionLabel(condition.severity)}</option>{conditionSeverities.map((severity) => <option key={severity} value={severity}>{conditionLabel(severity)}</option>)}</Select></div> : <p className="text-xs text-muted-foreground">Fishkeepers can record progress; an Aquarist updates status and severity.</p>}<Input name="affectedCount" type="number" min="0" step="0.1" placeholder="Updated affected count" /><Textarea name="notes" placeholder="What changed? Include observed signs, measurements, or actions." required /><label className="grid gap-1 text-sm font-medium"><span>Next follow-up</span><Input name="followUpDueAt" type="datetime-local" /></label><Button type="submit">Save observation</Button></form></CardContent></Card> : null}
          <Card><CardHeader><CardTitle>Assessment and plan</CardTitle></CardHeader><CardContent>{canEdit ? <form action={updateConditionPlan} className="grid gap-3"><input type="hidden" name="conditionId" value={condition.id} /><Textarea name="summary" defaultValue={condition.summary ?? ""} placeholder="Observed issue summary" /><Textarea name="suspectedCause" defaultValue={condition.suspectedCause ?? ""} placeholder="Causes to investigate, without claiming a diagnosis" /><Textarea name="actionPlan" defaultValue={condition.actionPlan ?? ""} placeholder="Observation and action plan" /><Textarea name="resolutionNotes" defaultValue={condition.resolutionNotes ?? ""} placeholder="Resolution notes" /><Button type="submit" variant="secondary">Save plan</Button></form> : <div className="space-y-3 text-sm"><TextBlock label="Summary" value={condition.summary} /><TextBlock label="Causes to investigate" value={condition.suspectedCause} /><TextBlock label="Action plan" value={condition.actionPlan} /><TextBlock label="Resolution" value={condition.resolutionNotes} /></div>}</CardContent></Card>
          <Card><CardHeader><CardTitle><CalendarClock className="mr-2 inline h-5 w-5" />Follow-ups</CardTitle></CardHeader><CardContent className="space-y-2">{condition.careTasks.length ? condition.careTasks.map((task) => <div key={task.id} className="rounded-md bg-muted/45 p-3"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{task.title}</span><Badge>{conditionLabel(task.priority)}</Badge></div><div className="text-xs text-muted-foreground">{formatDateTimeInTimeZone(task.dueAt, timeZone)} · {conditionLabel(task.status)}</div></div>) : <Empty text="No condition follow-ups scheduled." />}<Link className="text-sm font-semibold text-primary underline" href="/schedules">Open care queue</Link></CardContent></Card>
          <EddyConditionAssistant conditionId={condition.id} />
          {role === "COLLECTION_OWNER" && condition.status !== "ARCHIVED" ? <Card><CardContent className="p-4"><form action={archiveCondition}><input type="hidden" name="conditionId" value={condition.id} /><Button type="submit" variant="ghost"><Archive className="mr-2 h-4 w-4" />Archive condition</Button></form><p className="mt-2 text-xs text-muted-foreground">Archive preserves observations, links, photos, and resolved history.</p></CardContent></Card> : null}
        </div>
      </section>
    </div>
  );
}

async function entityLabel(collectionId: string, type: string, id: string) {
  if (type === "SPECIES") return prisma.speciesDefinition.findFirst({ where: { id, OR: [{ collectionId }, { collectionId: null }] }, select: { commonName: true } }).then((value) => value?.commonName ?? null);
  return prisma.aquariumItem.findFirst({ where: { id, collectionId }, select: { name: true } }).then((value) => value?.name ?? null);
}

function Fact({ label, value }: { label: string; value: string }) { return <Card><CardContent className="p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className="mt-1 font-semibold text-primary">{value}</div></CardContent></Card>; }
function Empty({ text }: { text: string }) { return <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{text}</div>; }
function TextBlock({ label, value }: { label: string; value: string | null }) { return <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div><p className="mt-1 whitespace-pre-wrap">{value || "Not recorded."}</p></div>; }
