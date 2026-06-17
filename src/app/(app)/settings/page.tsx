import { Activity, BriefcaseBusiness, Database, FileText, HardDriveDownload, ServerCog } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const serverCards = [
  { title: "App Health", icon: Activity, text: "Ready for uptime, health endpoint, deployment version, and reverse proxy checks." },
  { title: "Database", icon: Database, text: "SQLite locally today, with PostgreSQL-ready deployment notes for later." },
  { title: "Background Jobs", icon: BriefcaseBusiness, text: "Prepared area for scheduled workflow, backup, and metric ingestion workers." },
  { title: "Prometheus", icon: ServerCog, text: "Sensor channels can point at future Prometheus metrics without requiring a live server." },
  { title: "Backups", icon: HardDriveDownload, text: "Future exports for collection records, QR payloads, audit logs, and media." },
  { title: "Logs", icon: FileText, text: "Placeholder for service logs, audit trails, and operational notices." }
];

export default async function SettingsPage() {
  const collection = await prisma.collection.findFirst({ include: { owner: true } });

  return (
    <div>
      <PageHeader title="Settings" eyebrow="Collection and server management" />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>Collection</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Name" value={collection?.name} />
            <Info label="Owner" value={collection?.owner.name} />
            <Info label="Email" value={collection?.owner.email} />
          </CardContent>
        </Card>
        <section className="grid gap-4 md:grid-cols-2">
          {serverCards.map((card) => (
            <Card key={card.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <card.icon className="h-5 w-5 text-water" aria-hidden="true" />
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{card.text}</CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold text-primary">{value ?? "Not set"}</div>
    </div>
  );
}
