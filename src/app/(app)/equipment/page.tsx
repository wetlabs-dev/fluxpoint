import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { createEquipment, markEquipmentMaintained, updateEquipment } from "@/domains/management/actions";
import { ensureLightCapabilityProfiles } from "@/domains/lighting/capabilities";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EquipmentForm } from "@/components/equipment/EquipmentForm";
import { calculateScheduleLightLoad } from "@/domains/lighting/light-load";
import Link from "next/link";
import { CreatePanel } from "@/components/forms/CreatePanel";

export const dynamic = "force-dynamic";

const equipmentTypes = ["HEATER", "LIGHT", "FILTER", "PUMP", "AIR_PUMP", "CO2", "SENSOR", "CONTROLLER", "DOSER", "OTHER"];

export default async function EquipmentPage({ searchParams }: { searchParams?: Promise<{ create?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const params = await searchParams;
  await ensureLightCapabilityProfiles(collection.id);
  const equipment = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, itemType: "EQUIPMENT" },
    include: { aquariumAttachments: { include: { aquarium: true }, orderBy: { createdAt: "asc" } }, equipmentProfile: { include: { lightCapabilityProfile: true } }, source: true, lightingAssignments: { include: { schedule: { include: { capabilityProfile: true, points: { orderBy: { sortOrder: "asc" } } } } } } },
    orderBy: { name: "asc" }
  });
  const sources = await prisma.source.findMany({ where: { collectionId: collection.id }, orderBy: { name: "asc" } });
  const equipmentConditions = await prisma.healthCondition.findMany({ where: { collectionId: collection.id, entityId: { in: equipment.map((item) => item.id) }, status: { in: ["WATCHING", "ACTIVE", "TREATING", "IMPROVING", "WORSENING"] } }, select: { id: true, entityId: true, title: true, severity: true } });
  const lightCapabilities = await prisma.lightCapabilityProfile.findMany({ where: { collectionId: collection.id }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Equipment" eyebrow="Maintenance-aware gear" />
      <CreatePanel title="Create equipment" defaultOpen={Boolean(params?.create)}><EquipmentForm sources={sources} lightCapabilities={lightCapabilities} /></CreatePanel>
        <Card>
          <CardContent className="p-0">
            {equipment.length ? equipment.map((item) => {
              const profile = item.equipmentProfile;
              const dueIn = profile?.maintenanceIntervalDays && profile.lastMaintainedAt
                ? profile.maintenanceIntervalDays - differenceInCalendarDays(new Date(), profile.lastMaintainedAt)
                : null;
              return (
                <div key={item.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[1fr_150px_170px_130px_auto_auto] md:items-center">
                  <div>
                    <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/equipment/${item.id}`}>{item.name}</Link>
                    <div className="text-sm text-muted-foreground">{profile?.brand ?? "Unknown brand"} {profile?.model ?? ""}</div>
                    {profile?.lightCapabilityProfile ? <div className="text-xs text-muted-foreground">Light profile: {profile.lightCapabilityProfile.name}</div> : null}
                    {profile?.equipmentType === "LIGHT" ? <LightLoadDetail profile={profile} assignments={item.lightingAssignments} /> : null}
                    <div className="text-xs text-muted-foreground">{item.source?.name ?? "No source"}{item.purchasePrice ? ` · $${item.purchasePrice}` : ""}</div>
                    {equipmentConditions.some((condition) => condition.entityId === item.id) ? <div className="mt-1 text-xs font-semibold text-rose-500">{equipmentConditions.filter((condition) => condition.entityId === item.id).length} active equipment condition(s)</div> : null}
                  </div>
                  <Badge>{profile?.equipmentType ?? "OTHER"}</Badge>
                  <div className="text-sm">{item.aquariumAttachments.length ? item.aquariumAttachments.map((attachment) => `${attachment.aquarium.generatedName ?? attachment.aquarium.name} (${attachment.role.toLowerCase().replaceAll("_", " ")})`).join(" · ") : "Not attached"}</div>
                  <Badge className={dueIn !== null && dueIn <= 0 ? "bg-sand/50 text-primary" : ""}>
                    {dueIn === null ? "No schedule" : dueIn <= 0 ? "Due now" : `${dueIn}d left`}
                  </Badge>
                  <form action={markEquipmentMaintained}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <Button type="submit" variant="secondary">Mark maintained</Button>
                  </form>
                  <Link href={`/equipment/${item.id}?view=labels`}><Button variant="secondary">QR / labels</Button></Link>
                  <Link className="text-sm font-semibold text-primary underline" href={`/conditions?entityType=EQUIPMENT&entityId=${item.id}`}>Log issue</Link>
                  <details className="md:col-span-6 rounded-md border border-border bg-background/45 p-3">
                    <summary className="cursor-pointer font-semibold text-primary">Edit equipment</summary>
                    <EquipmentForm sources={sources} lightCapabilities={lightCapabilities} item={item} />
                  </details>
                </div>
              );
            }) : <div className="p-8 text-center text-muted-foreground">Create your first equipment record.</div>}
          </CardContent>
        </Card>
    </div>
  );
}

function LightLoadDetail({ profile, assignments }: { profile: any; assignments: any[] }) {
  if (!assignments.length) return <div className="text-xs text-muted-foreground">No aquarium schedule assignments.</div>;
  return <div className="text-xs text-muted-foreground">{assignments.map((assignment) => { if (!assignment.enabled) return "Assignment disabled"; if (!assignment.schedule) return "No schedule assigned"; const estimate = calculateScheduleLightLoad(assignment.schedule.points, assignment.schedule.capabilityProfile, profile, assignment.schedule.rampMinutes); return `${assignment.schedule.name} · ${estimate.displayValue}${estimate.outputMethod === "WATTAGE_ESTIMATED" ? ` · estimated from wattage (${estimate.confidence.toLowerCase()})` : ""}`; }).join(" · ")}</div>;
}

function LegacyEquipmentForm({
  aquariums,
  sources,
  lightCapabilities,
  item
}: {
  aquariums: { id: string; name: string; generatedName: string | null }[];
  sources: { id: string; name: string }[];
  lightCapabilities: { id: string; name: string }[];
  item?: {
    id: string;
    name: string;
    aquariumId: string | null;
    sourceId: string | null;
    purchasePrice: any;
    notes: string | null;
    equipmentProfile: {
      equipmentType: string;
      lightCapabilityProfileId: string | null;
      brand: string | null;
      model: string | null;
      serialNumber: string | null;
      purchaseDate: Date | null;
      warrantyUntil: Date | null;
      maintenanceIntervalDays: number | null;
      lastMaintainedAt: Date | null;
      notes: string | null;
    } | null;
  };
}) {
  const profile = item?.equipmentProfile;
  const notes = item?.notes ?? profile?.notes ?? "";
  return (
    <form action={item ? updateEquipment : createEquipment} className="mt-4 grid gap-5">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <section className="grid gap-3 md:grid-cols-2">
        <SectionLabel title="Identity" />
        <Input className="md:col-span-2" name="name" placeholder="Equipment name" defaultValue={item?.name ?? ""} required />
        <Select name="equipmentType" defaultValue={profile?.equipmentType ?? "LIGHT"}>{equipmentTypes.map((type) => <option key={type}>{type}</option>)}</Select>
        <Select name="aquariumId" defaultValue={item?.aquariumId ?? ""}>
          <option value="">Storage/no tank</option>
          {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
        </Select>
        <Input name="brand" placeholder="Brand" defaultValue={profile?.brand ?? ""} />
        <Input name="model" placeholder="Model" defaultValue={profile?.model ?? ""} />
        <label className="grid gap-1 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Light capability</span>
          <Select name="lightCapabilityProfileId" defaultValue={profile?.lightCapabilityProfileId ?? ""}>
            <option value="">Not a controllable light</option>
            {lightCapabilities.map((capability) => <option key={capability.id} value={capability.id}>{capability.name}</option>)}
          </Select>
          <span className="text-xs text-muted-foreground">Used only when equipment type is LIGHT; schedule assignments are matched against this profile.</span>
        </label>
        <Input className="font-mono md:col-span-2" name="serialNumber" placeholder="Serial number" defaultValue={profile?.serialNumber ?? ""} />
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <SectionLabel title="Ownership" />
        <Select name="sourceId" defaultValue={item?.sourceId ?? ""}>
          <option value="">No source/vendor</option>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
        </Select>
        <Input name="purchasePrice" type="number" step="0.01" placeholder="Unit price" defaultValue={item?.purchasePrice ?? ""} />
        <Input name="purchaseDate" type="date" defaultValue={profile?.purchaseDate ? profile.purchaseDate.toISOString().slice(0, 10) : ""} />
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <SectionLabel title="Warranty" />
        <Input name="warrantyUntil" type="date" defaultValue={profile?.warrantyUntil ? profile.warrantyUntil.toISOString().slice(0, 10) : ""} />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <SectionLabel title="Maintenance" />
        <Field label="Maintenance interval">
          <Input name="maintenanceIntervalDays" type="number" placeholder="Days between care" defaultValue={profile?.maintenanceIntervalDays ?? ""} />
        </Field>
        <Field label="Last maintained">
          <Input name="lastMaintainedAt" type="date" defaultValue={profile?.lastMaintainedAt ? profile.lastMaintainedAt.toISOString().slice(0, 10) : ""} />
        </Field>
      </section>
      <Textarea name="notes" placeholder="Notes" defaultValue={notes} />
      <Button type="submit">{item ? "Save equipment" : "Create equipment"}</Button>
    </form>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:col-span-full">{title}</h3>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
