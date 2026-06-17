import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { createEquipment, markEquipmentMaintained, updateEquipment } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const equipmentTypes = ["HEATER", "LIGHT", "FILTER", "PUMP", "AIR_PUMP", "CO2", "SENSOR", "CONTROLLER", "DOSER", "OTHER"];

export default async function EquipmentPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const equipment = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, itemType: "EQUIPMENT" },
    include: { aquarium: true, equipmentProfile: true },
    orderBy: { name: "asc" }
  });
  const aquariums = await prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Equipment" eyebrow="Maintenance-aware gear" />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardContent className="p-0">
            {equipment.length ? equipment.map((item) => {
              const profile = item.equipmentProfile;
              const dueIn = profile?.maintenanceIntervalDays && profile.lastMaintainedAt
                ? profile.maintenanceIntervalDays - differenceInCalendarDays(new Date(), profile.lastMaintainedAt)
                : null;
              return (
                <div key={item.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[1fr_150px_170px_130px_auto] md:items-center">
                  <div>
                    <div className="font-semibold text-primary">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{profile?.brand ?? "Unknown brand"} {profile?.model ?? ""}</div>
                  </div>
                  <Badge>{profile?.equipmentType ?? "OTHER"}</Badge>
                  <div className="text-sm">{item.aquarium?.generatedName ?? item.aquarium?.name ?? "Storage"}</div>
                  <Badge className={dueIn !== null && dueIn <= 0 ? "bg-sand/50 text-primary" : ""}>
                    {dueIn === null ? "No schedule" : dueIn <= 0 ? "Due now" : `${dueIn}d left`}
                  </Badge>
                  <form action={markEquipmentMaintained}>
                    <input type="hidden" name="itemId" value={item.id} />
                    <Button type="submit" variant="secondary">Mark maintained</Button>
                  </form>
                  <details className="md:col-span-5 rounded-md border border-border bg-background/45 p-3">
                    <summary className="cursor-pointer font-semibold text-primary">Edit equipment</summary>
                    <EquipmentForm aquariums={aquariums} item={item} />
                  </details>
                </div>
              );
            }) : <div className="p-8 text-center text-muted-foreground">Create your first equipment record.</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Create equipment</CardTitle></CardHeader>
          <CardContent>
            <EquipmentForm aquariums={aquariums} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EquipmentForm({
  aquariums,
  item
}: {
  aquariums: { id: string; name: string; generatedName: string | null }[];
  item?: {
    id: string;
    name: string;
    aquariumId: string | null;
    notes: string | null;
    equipmentProfile: {
      equipmentType: string;
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
  return (
    <form action={item ? updateEquipment : createEquipment} className="mt-3 grid gap-3 md:grid-cols-2">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <Input className="md:col-span-2" name="name" placeholder="Equipment name" defaultValue={item?.name ?? ""} required />
      <Select name="equipmentType" defaultValue={profile?.equipmentType ?? "LIGHT"}>{equipmentTypes.map((type) => <option key={type}>{type}</option>)}</Select>
      <Select name="aquariumId" defaultValue={item?.aquariumId ?? ""}>
        <option value="">Storage/no tank</option>
        {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
      </Select>
      <Input name="brand" placeholder="Brand" defaultValue={profile?.brand ?? ""} />
      <Input name="model" placeholder="Model" defaultValue={profile?.model ?? ""} />
      <Input className="font-mono" name="serialNumber" placeholder="Serial number" defaultValue={profile?.serialNumber ?? ""} />
      <Input name="maintenanceIntervalDays" type="number" placeholder="Maintenance interval days" defaultValue={profile?.maintenanceIntervalDays ?? ""} />
      <Input name="purchaseDate" type="date" defaultValue={profile?.purchaseDate ? profile.purchaseDate.toISOString().slice(0, 10) : ""} />
      <Input name="warrantyUntil" type="date" defaultValue={profile?.warrantyUntil ? profile.warrantyUntil.toISOString().slice(0, 10) : ""} />
      <Input name="lastMaintainedAt" type="date" defaultValue={profile?.lastMaintainedAt ? profile.lastMaintainedAt.toISOString().slice(0, 10) : ""} />
      <Textarea className="md:col-span-2" name="notes" placeholder="Item notes" defaultValue={item?.notes ?? ""} />
      <Textarea className="md:col-span-2" name="profileNotes" placeholder="Equipment notes" defaultValue={profile?.notes ?? ""} />
      <Button className="md:col-span-2" type="submit">{item ? "Save equipment" : "Create equipment"}</Button>
    </form>
  );
}
