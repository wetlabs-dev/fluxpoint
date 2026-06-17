import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const equipment = await prisma.aquariumItem.findMany({
    where: { itemType: "EQUIPMENT" },
    include: { aquarium: true, equipmentProfile: true },
    orderBy: { name: "asc" }
  });

  return (
    <div>
      <PageHeader title="Equipment" eyebrow="Maintenance-aware gear" />
      <Card>
        <CardContent className="p-0">
          {equipment.length ? equipment.map((item) => {
            const profile = item.equipmentProfile;
            const dueIn = profile?.maintenanceIntervalDays && profile.lastMaintainedAt
              ? profile.maintenanceIntervalDays - differenceInCalendarDays(new Date(), profile.lastMaintainedAt)
              : null;
            return (
              <div key={item.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[1fr_160px_180px_130px] md:items-center">
                <div>
                  <div className="font-semibold text-primary">{item.name}</div>
                  <div className="text-sm text-muted-foreground">{profile?.brand ?? "Unknown brand"} {profile?.model ?? ""}</div>
                </div>
                <Badge>{profile?.equipmentType ?? "OTHER"}</Badge>
                <div className="text-sm">{item.aquarium?.generatedName ?? item.aquarium?.name ?? "Storage"}</div>
                <Badge className={dueIn !== null && dueIn <= 0 ? "bg-sand/50 text-primary" : ""}>
                  {dueIn === null ? "No schedule" : dueIn <= 0 ? "Due now" : `${dueIn}d left`}
                </Badge>
              </div>
            );
          }) : <div className="p-8 text-center text-muted-foreground">No equipment records yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
