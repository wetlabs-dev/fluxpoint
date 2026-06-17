import { Activity, Box, Database, FileText, HardDriveDownload, Network, ServerCog, Workflow } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { logout } from "@/domains/auth/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const serverCards = [
  { title: "Caddy Edge Proxy", icon: Network, text: "Dockerized Caddy terminates HTTPS and proxies the app subdomain to the internal app container." },
  { title: "App Container", icon: Box, text: "Standalone Next.js runs on the Compose network at port 3000, without exposing the app port publicly." },
  { title: "PostgreSQL", icon: Database, text: "Postgres 16 is the supported production database, persisted in a Docker volume." },
  { title: "Migration Job", icon: Workflow, text: "A one-shot migrate/bootstrap container prepares the database before app and workers start." },
  { title: "Workers", icon: ServerCog, text: "Reminder, metrics, backup, and AI worker containers are prepared with safe placeholder loops." },
  { title: "Backups", icon: HardDriveDownload, text: "Postgres dump and restore scripts are ready for operator-driven backup workflows." },
  { title: "Metrics", icon: Activity, text: "Prepared for future app metrics, sensor summaries, and Prometheus integration checks." },
  { title: "Logs", icon: FileText, text: "Use Docker Compose logs for app, Caddy, migration, and worker observability." }
];

export default async function SettingsPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const counts = {
    aquariums: await prisma.aquarium.count({ where: { collectionId: collection.id } }),
    items: await prisma.aquariumItem.count({ where: { collectionId: collection.id } }),
    workflows: await prisma.workflowRun.count({ where: { aquarium: { collectionId: collection.id } } })
  };

  return (
    <div>
      <PageHeader title="Settings" eyebrow="Collection and server management" />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>Account and collection</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="User" value={user.name} />
            <Info label="Email" value={user.email} />
            <Info label="Collection" value={collection.name} />
            <Info label="Records" value={`${counts.aquariums} aquariums · ${counts.items} items · ${counts.workflows} workflows`} />
            <form action={logout}>
              <Button type="submit" variant="secondary" className="w-full">Log out</Button>
            </form>
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
