import { Box, CheckCircle2, Clock3, Database, MapPin, Store, UserCircle2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { logout } from "@/domains/auth/actions";
import { createLocation, createSource } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { buildLocationPath } from "@/lib/format/location";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const dynamic = "force-dynamic";

const locationTypes = ["ROOM", "RACK", "SHELF", "STAND", "CABINET", "OUTDOOR_AREA", "OTHER"];
const sourceTypes = ["STORE", "ONLINE_VENDOR", "BREEDER", "LOCAL_CLUB", "FRIEND", "IMPORTER", "SELF_PROPAGATED", "OTHER"];

export default async function SettingsPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const [counts, locations, sources] = await Promise.all([
    Promise.all([
      prisma.aquarium.count({ where: { collectionId: collection.id } }),
      prisma.aquariumItem.count({ where: { collectionId: collection.id } }),
      prisma.workflowRun.count({ where: { aquarium: { collectionId: collection.id } } })
    ]),
    prisma.location.findMany({
      where: { collectionId: collection.id },
      include: { parent: { include: { parent: true } }, _count: { select: { aquariums: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.source.findMany({
      where: { collectionId: collection.id },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" }
    })
  ]);
  const [aquariumCount, itemCount, workflowCount] = counts;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" eyebrow="Collection controls" />

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserCircle2 className="h-5 w-5 text-water" /> Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="User" value={user.name} />
              <Info label="Email" value={user.email} />
              <form action={logout}>
                <Button type="submit" variant="secondary" className="w-full">Log out</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Collection</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Name" value={collection.name} />
              <Info label="Description" value={collection.description} />
              <Info label="Records" value={`${aquariumCount} aquariums · ${itemCount} items · ${workflowCount} workflows`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Choose a color mode for the authenticated app. System follows your device preference.</p>
              <ThemeToggle />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <section className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-water" /> Locations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {locations.length ? locations.map((location) => (
                    <div key={location.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3">
                      <div>
                        <div className="font-semibold text-primary">{buildLocationPath(location)}</div>
                        <div className="text-xs text-muted-foreground">{location.description ?? "No notes yet"}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge>{location.type}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{location._count.aquariums} tanks</span>
                      </div>
                    </div>
                  )) : <EmptyLine text="No structured locations yet." />}
                </div>
                <form action={createLocation} className="grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-2">
                  <Input name="name" placeholder="Location name" required />
                  <Select name="type" defaultValue="ROOM">
                    {locationTypes.map((type) => <option key={type}>{type}</option>)}
                  </Select>
                  <Select name="parentId" defaultValue="">
                    <option value="">No parent</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{buildLocationPath(location)}</option>)}
                  </Select>
                  <Input name="sortOrder" type="number" placeholder="Sort order" />
                  <Textarea className="md:col-span-2" name="description" placeholder="Description" />
                  <Button className="md:col-span-2" type="submit">Add location</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-water" /> Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {sources.length ? sources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3">
                      <div>
                        <div className="font-semibold text-primary">{source.name}</div>
                        <div className="text-xs text-muted-foreground">{source.website ?? source.notes ?? "No website or notes yet"}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge>{source.type}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{source._count.items} items</span>
                      </div>
                    </div>
                  )) : <EmptyLine text="No structured sources yet." />}
                </div>
                <form action={createSource} className="grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-2">
                  <Input name="name" placeholder="Source name" required />
                  <Select name="type" defaultValue="STORE">
                    {sourceTypes.map((type) => <option key={type}>{type}</option>)}
                  </Select>
                  <Input className="md:col-span-2" name="website" placeholder="Website" />
                  <Textarea className="md:col-span-2" name="notes" placeholder="Notes" />
                  <Button className="md:col-span-2" type="submit">Add source</Button>
                </form>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader><CardTitle>Server Health</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <HealthCard icon={CheckCircle2} label="App" value="Online" note="This page rendered successfully." />
              <HealthCard icon={Database} label="Database" value="Connected" note="Counts and settings records loaded." />
              <HealthCard icon={Clock3} label="Workers" value="Not wired yet" note="Reminder and sensor workers are placeholders." muted />
              <HealthCard icon={Box} label="Backups" value="Not wired yet" note="Operator backup scripts exist; status is not tracked in-app yet." muted />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-primary">{value ?? "Not set"}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}

function HealthCard({
  icon: Icon,
  label,
  value,
  note,
  muted = false
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background/55 p-4">
      <Icon className={muted ? "h-5 w-5 text-muted-foreground" : "h-5 w-5 text-water"} />
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono font-semibold text-primary">{value}</div>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
