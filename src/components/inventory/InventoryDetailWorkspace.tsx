import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ArrowRightLeft, Camera, HeartPulse, History, Package, Pill, QrCode, Wrench } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionRole } from "@/domains/auth/permissions";
import { getInventoryEntityHistory } from "@/domains/history/entity-history";
import { createMaintenanceEvent, logInhabitantLoss, markEquipmentMaintained, transferItem } from "@/domains/management/actions";
import { calculateScheduleLightLoad } from "@/domains/lighting/light-load";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ConditionBadge } from "@/components/conditions/ConditionBadge";
import { EntityHistoryList } from "@/components/history/EntityHistoryList";
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaUploadButton } from "@/components/media/MediaUploadButton";
import { LabelActions } from "@/components/labels/LabelActions";
import { formatFishSexBreakdown } from "@/domains/inventory/fish-sex";

const tabs = [["overview", "Overview"], ["history", "Timeline / History"], ["conditions", "Conditions"], ["treatments", "Treatments"], ["maintenance", "Maintenance"], ["photos", "Photos"], ["labels", "QR / Labels"]] as const;

export async function InventoryDetailWorkspace({ id, view = "overview", equipmentOnly = false }: { id: string; view?: string; equipmentOnly?: boolean }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const role = await getCollectionRole(user.id, collection.id);
  const item = await prisma.aquariumItem.findFirst({
    where: { id, collectionId: collection.id, ...(equipmentOnly ? { itemType: "EQUIPMENT" as const } : {}) },
    include: {
      aquarium: true,
      storageLocation: true,
      quarantineProject: true,
      source: true,
      speciesDefinition: { include: { aliases: true, regionalStatuses: { where: { collectionId: collection.id } } } },
      equipmentProfile: { include: { lightCapabilityProfile: true } },
      aquariumAttachments: { include: { aquarium: true }, orderBy: { createdAt: "asc" } },
      lightingAssignments: {
        include: {
          aquarium: true,
          schedule: {
            include: { capabilityProfile: true, points: { orderBy: { sortOrder: "asc" } } }
          }
        }
      },
      mediaAssets: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!item) notFound();
  const entityType = item.itemType === "EQUIPMENT" ? "EQUIPMENT" : "INVENTORY";
  const basePath = item.itemType === "EQUIPMENT" && equipmentOnly ? `/equipment/${item.id}` : `/inventory/${item.id}`;
  const aquariumId = item.aquariumId ?? item.aquariumAttachments[0]?.aquariumId ?? null;
  const [history, conditions, qr, labels, aquariums, locations, quarantines] = await Promise.all([
    getInventoryEntityHistory(collection.id, item.id),
    prisma.healthCondition.findMany({
      where: {
        collectionId: collection.id,
        OR: [
          { entityId: item.id },
          { links: { some: { linkedEntityId: item.id, linkedEntityType: { in: ["INVENTORY_ITEM", "EQUIPMENT"] } } } }
        ]
      },
      include: {
        observations: { orderBy: { observedAt: "desc" }, take: 3 },
        medicationCourses: { include: { medicationDefinition: true, doseEvents: true }, orderBy: { startedAt: "desc" } },
        mediaAssets: true
      },
      orderBy: { firstObservedAt: "desc" }
    }),
    prisma.qrCode.findFirst({ where: { collectionId: collection.id, entityType, entityId: item.id } }),
    prisma.generatedLabel.findMany({ where: { collectionId: collection.id, entityType, entityId: item.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { collectionId: collection.id }, orderBy: { name: "asc" } }),
    prisma.quarantineProject.findMany({ where: { collectionId: collection.id, status: "ACTIVE" }, orderBy: { name: "asc" } })
  ]);
  const currentView = tabs.some(([key]) => key === view) ? view : "overview";
  const canOperate = role !== "VIEWER";
  const profile = item.equipmentProfile;
  const nextMaintenance = profile?.maintenanceIntervalDays && profile.lastMaintainedAt ? addDays(profile.lastMaintainedAt, profile.maintenanceIntervalDays) : null;
  const maintenanceEvents = history.filter((entry) => entry.eventType === "EQUIPMENT_MAINTENANCE" || entry.eventType === "MAINTENANCE" || entry.metadata?.maintenanceType || entry.eventType === "REPAIR_SERVICE");
  const medicationCourses = conditions.flatMap((condition) => condition.medicationCourses.map((course) => ({ ...course, condition })));
  const attachedAquariums = item.aquariumAttachments.map((entry) => entry.aquarium.generatedName ?? entry.aquarium.name).join(" · ");
  const placement = (item.aquarium?.generatedName ?? item.aquarium?.name ?? attachedAquariums) || item.storageLocation?.name || item.quarantineProject?.name || item.status.toLowerCase().replaceAll("_", " ");
  const sexBreakdown = formatFishSexBreakdown(item);
  return <div className="space-y-6">
    <PageHeader title={item.name} eyebrow="Inventory detail"><div className="flex flex-wrap gap-2"><Badge>{item.itemType.toLowerCase()}</Badge><Badge>{item.status.toLowerCase().replaceAll("_", " ")}</Badge><Badge>{item.quantity} {item.unit ?? "units"}</Badge></div></PageHeader>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Fact label="Placement" value={placement} /><Fact label="Species" value={item.speciesDefinition?.commonName ?? "Not linked"} /><Fact label="Acquired" value={item.acquiredAt ? format(item.acquiredAt, "MMM d, yyyy") : "Not recorded"} /><Fact label={sexBreakdown ? "Sex breakdown" : "QR code"} value={sexBreakdown ?? qr?.publicCode ?? "Not generated"} mono={!sexBreakdown} /></div>
    <nav className="flex gap-2 overflow-x-auto border-y border-border py-2" aria-label="Inventory detail sections">{tabs.filter(([key]) => key !== "maintenance" || item.itemType === "EQUIPMENT").map(([key, label]) => <Link key={key} href={`${basePath}?view=${key}`} className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold ${currentView === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{label}</Link>)}</nav>
    {currentView === "overview" ? <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"><Card><CardHeader><CardTitle><Package className="mr-2 inline h-5 w-5" />Overview</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Info label="Name" value={item.name} /><Info label="Type" value={item.itemType} /><Info label="Status" value={item.status} /><Info label="Quantity" value={`${item.quantity} ${item.unit ?? "units"}`} />{sexBreakdown ? <Info label="Sex breakdown" value={sexBreakdown} /> : null}<Info label="Source / vendor" value={item.source?.name ?? item.acquiredFrom} /><Info label="Purchase price" value={item.purchasePrice ? `$${item.purchasePrice}` : null} /><Info label="Scientific name" value={item.speciesDefinition?.scientificName} /><Info label="Aliases" value={item.speciesDefinition?.aliases.map((entry) => entry.alias).join(" · ")} /><Info label="Description" value={item.description} /><Info label="Notes" value={item.notes} />{profile ? <><Info label="Equipment" value={`${profile.equipmentType}${profile.brand ? ` · ${profile.brand}` : ""}${profile.model ? ` ${profile.model}` : ""}`} /><Info label="Serial" value={profile.serialNumber} /><Info label="Warranty" value={profile.warrantyUntil ? format(profile.warrantyUntil, "MMM d, yyyy") : null} /><Info label="Next maintenance" value={nextMaintenance ? `${format(nextMaintenance, "MMM d, yyyy")} (${differenceInCalendarDays(nextMaintenance, new Date())}d)` : null} />{profile.equipmentType === "LIGHT" ? <LightLoad item={item} /> : null}</> : null}</CardContent></Card><QuickActions item={item} aquariumId={aquariumId} conditionId={conditions[0]?.id ?? null} canOperate={canOperate} aquariums={aquariums} locations={locations} quarantines={quarantines} basePath={basePath} /></section> : null}
    {currentView === "history" ? <Card><CardHeader><CardTitle><History className="mr-2 inline h-5 w-5" />Object history</CardTitle><p className="text-sm text-muted-foreground">A read-only aggregation of existing movement, aquarium timeline, condition, treatment, photo, quarantine, and label records.</p></CardHeader><CardContent><EntityHistoryList entries={history} /></CardContent></Card> : null}
    {currentView === "conditions" ? <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle><HeartPulse className="mr-2 inline h-5 w-5" />Conditions</CardTitle>{canOperate ? <Link className="text-sm font-semibold text-primary underline" href={`/conditions?aquariumId=${aquariumId ?? ""}&entityType=${item.itemType === "EQUIPMENT" ? "EQUIPMENT" : ["FISH", "INVERT", "PLANT"].includes(item.itemType) ? item.itemType : "INVENTORY_ITEM"}&entityId=${item.id}`}>Log condition</Link> : null}</div></CardHeader><CardContent className="space-y-3">{conditions.length ? conditions.map((condition) => <Link key={condition.id} href={`/conditions/${condition.id}`} className="block rounded-md border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-primary">{condition.title}</strong><div className="flex gap-2"><ConditionBadge value={condition.severity} kind="severity" /><ConditionBadge value={condition.status} /></div></div><p className="mt-1 text-sm text-muted-foreground">{condition.summary ?? condition.conditionType} · {condition.observations.length} recent observation(s)</p></Link>) : <Empty text="No conditions are linked to this item." />}</CardContent></Card> : null}
    {currentView === "treatments" ? <Card><CardHeader><CardTitle><Pill className="mr-2 inline h-5 w-5" />Medications / Treatments</CardTitle></CardHeader><CardContent className="space-y-3">{medicationCourses.length ? medicationCourses.map((course) => <Link key={course.id} href={`/conditions/${course.condition.id}`} className="block rounded-md border border-border p-4"><strong className="text-primary">{course.title}</strong><p className="text-sm text-muted-foreground">{course.medicationDefinition.name} · {course.status.toLowerCase()} · {course.doseEvents.length} dose event(s)</p></Link>) : <Empty text="No medication courses are linked through this item’s conditions." />}</CardContent></Card> : null}
    {currentView === "maintenance" && item.itemType === "EQUIPMENT" ? <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"><Card><CardHeader><CardTitle><Wrench className="mr-2 inline h-5 w-5" />Maintenance and service</CardTitle></CardHeader><CardContent><EntityHistoryList entries={maintenanceEvents} /></CardContent></Card><Card><CardHeader><CardTitle>Equipment details</CardTitle></CardHeader><CardContent className="space-y-3"><Info label="Last maintained" value={profile?.lastMaintainedAt ? format(profile.lastMaintainedAt, "MMM d, yyyy") : null} /><Info label="Interval" value={profile?.maintenanceIntervalDays ? `${profile.maintenanceIntervalDays} days` : null} /><Info label="Warranty" value={profile?.warrantyUntil ? format(profile.warrantyUntil, "MMM d, yyyy") : null} />{profile?.equipmentType === "LIGHT" ? <LightLoad item={item} /> : null}</CardContent></Card></section> : null}
    {currentView === "photos" ? <Card><CardHeader><CardTitle><Camera className="mr-2 inline h-5 w-5" />Photos</CardTitle></CardHeader><CardContent className="space-y-4">{aquariumId && canOperate ? <MediaUploadButton aquariumId={aquariumId} defaultItemId={item.id} /> : null}{item.mediaAssets.length ? <MediaGallery assets={item.mediaAssets as never} /> : <Empty text={aquariumId ? "No photos are attached to this item." : "Assign this item to an aquarium before adding a moderated photo."} />}</CardContent></Card> : null}
    {currentView === "labels" ? <Card><CardHeader><CardTitle><QrCode className="mr-2 inline h-5 w-5" />QR and printable labels</CardTitle><p className="text-sm text-muted-foreground">The stable code does not change when this record is renamed. Downloads require collection access.</p></CardHeader><CardContent><LabelActions entityType={entityType} entityId={item.id} canGenerate={canOperate} allowedTypes={item.itemType === "EQUIPMENT" ? ["SIMPLE_QR", "EQUIPMENT_DETAIL"] : ["SIMPLE_QR", "ENTITY_DETAIL"]} labels={labels} /></CardContent></Card> : null}
  </div>;
}

function QuickActions({ item, aquariumId, conditionId, canOperate, aquariums, locations, quarantines, basePath }: any) {
  if (!canOperate) return <Card><CardHeader><CardTitle>Quick actions</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Viewer access is read-only.</p></CardContent></Card>;
  const livestock = ["FISH", "INVERT", "PLANT", "BOTANICAL", "OTHER"].includes(item.itemType);
  const conditionEntityType = item.itemType === "EQUIPMENT" ? "EQUIPMENT" : ["FISH", "INVERT", "PLANT"].includes(item.itemType) ? item.itemType : "INVENTORY_ITEM";
  return <Card><CardHeader><CardTitle>Quick actions</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Link href={`${basePath}?view=labels`}><Button variant="secondary"><QrCode className="mr-2 h-4 w-4" />Print label</Button></Link><Link href={`/conditions?aquariumId=${aquariumId ?? ""}&entityType=${conditionEntityType}&entityId=${item.id}`}><Button variant="secondary"><HeartPulse className="mr-2 h-4 w-4" />Log issue</Button></Link>{conditionId ? <Link href={`/conditions/${conditionId}`}><Button variant="secondary">Add observation</Button></Link> : null}{livestock && aquariumId ? <Link href={`/aquariums/${aquariumId}?workspace=schedules#medication-form`}><Button variant="secondary"><Pill className="mr-2 h-4 w-4" />Start medication</Button></Link> : null}</div><details className="rounded-md border border-border p-3"><summary className="cursor-pointer font-semibold text-primary"><ArrowRightLeft className="mr-2 inline h-4 w-4" />Move / assign</summary><form action={transferItem} className="mt-3 grid gap-2"><input type="hidden" name="itemId" value={item.id} /><Select name="destinationType" defaultValue="AQUARIUM"><option value="AQUARIUM">Aquarium</option><option value="STORAGE">Storage</option><option value="QUARANTINE">Quarantine</option><option value="CONSUMED">Consumed</option><option value="REMOVED">Removed</option><option value="DEAD">Lost / dead</option></Select><Select name="toAquariumId" defaultValue=""><option value="">No aquarium</option>{aquariums.map((entry: any) => <option key={entry.id} value={entry.id}>{entry.generatedName ?? entry.name}</option>)}</Select><Select name="toStorageLocationId" defaultValue=""><option value="">No storage location</option>{locations.map((entry: any) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select><Select name="toQuarantineProjectId" defaultValue=""><option value="">No quarantine</option>{quarantines.map((entry: any) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select><Input name="quantity" type="number" min="0.1" step="0.1" defaultValue={item.quantity} /><Input name="reason" placeholder="Reason" /><Button type="submit">Move item</Button></form></details>{item.itemType === "EQUIPMENT" ? <><details className="rounded-md border border-border p-3"><summary className="cursor-pointer font-semibold text-primary">Log maintenance or repair</summary>{aquariumId ? <form action={createMaintenanceEvent} className="mt-3 grid gap-2"><input type="hidden" name="aquariumId" value={aquariumId} /><input type="hidden" name="equipmentItemId" value={item.id} /><Select name="maintenanceType" defaultValue="EQUIPMENT_INSPECTION"><option value="EQUIPMENT_INSPECTION">Inspection / maintenance</option><option value="FILTER_SERVICE">Filter service</option><option value="LIGHT_ADJUSTMENT">Light adjustment</option><option value="REPAIR_SERVICE">Repair / service</option><option value="OTHER">Other</option></Select><Input name="title" placeholder="Work performed" /><Textarea name="notes" placeholder="Service notes" /><Button type="submit">Log service</Button></form> : <p className="mt-2 text-sm text-muted-foreground">Assign this equipment to an aquarium before logging a tank maintenance event.</p>}</details><form action={markEquipmentMaintained}><input type="hidden" name="itemId" value={item.id} /><Button type="submit" variant="secondary" className="w-full">Mark maintained now</Button></form></> : null}{livestock && aquariumId ? <details className="rounded-md border border-border p-3"><summary className="cursor-pointer font-semibold text-primary">Log loss / removal</summary><form action={logInhabitantLoss} className="mt-3 grid gap-2"><input type="hidden" name="aquariumId" value={aquariumId} /><input type="hidden" name="itemId" value={item.id} /><Input name="quantity" type="number" min="0.1" step="0.1" defaultValue="1" /><Input name="suspectedCause" placeholder="Observed or suspected cause" /><Textarea name="notes" placeholder="Loss or removal notes" /><Button type="submit" variant="secondary">Log loss</Button></form></details> : null}</CardContent></Card>;
}

function LightLoad({ item }: { item: any }) { const rows = item.lightingAssignments.map((assignment: any) => { if (!assignment.enabled) return `${assignment.aquarium?.generatedName ?? assignment.aquarium?.name ?? "Aquarium"}: disabled`; if (!assignment.schedule) return `${assignment.aquarium?.generatedName ?? assignment.aquarium?.name ?? "Aquarium"}: no schedule`; const result = calculateScheduleLightLoad(assignment.schedule.points, assignment.schedule.capabilityProfile, item.equipmentProfile, assignment.schedule.rampMinutes); return `${assignment.aquarium?.generatedName ?? assignment.aquarium?.name ?? "Aquarium"}: ${assignment.schedule.name} · ${result.displayValue}${result.outputMethod === "WATTAGE_ESTIMATED" ? ` (${result.confidence.toLowerCase()} confidence, estimated from wattage)` : ""}`; }); return <Info label="Estimated daily light load" value={rows.length ? rows.join("\n") : "Assign this light to an aquarium and schedule"} />; }
function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <Card><CardContent className="p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className={`mt-1 font-semibold text-primary ${mono ? "font-mono" : ""}`}>{value}</div></CardContent></Card>; }
function Info({ label, value }: { label: string; value?: string | null }) { return <div className="rounded-md bg-muted/45 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 whitespace-pre-wrap text-sm text-primary">{value || "Not recorded"}</div></div>; }
function Empty({ text }: { text: string }) { return <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</p>; }
