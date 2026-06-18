import { readdir, stat } from "fs/promises";
import path from "path";
import { Box, CheckCircle2, Clock3, Database, HardDriveDownload, MapPin, Store, UserCircle2 } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { changePassword, logout, updateProfile } from "@/domains/auth/actions";
import { createLightingSchedule, createLocation, createSource } from "@/domains/management/actions";
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
  const backupFiles = await getBackupFiles();
  const [counts, locations, sources, lightingSchedules] = await Promise.all([
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
    }),
    prisma.lightingSchedule.findMany({
      where: { collectionId: collection.id },
      include: { points: { orderBy: { sortOrder: "asc" } }, _count: { select: { assignments: true } } },
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
              <form action={updateProfile} className="grid gap-2 rounded-md bg-muted/45 p-3">
                <label className="grid gap-1 text-sm font-medium">
                  <span>Display name</span>
                  <Input name="name" defaultValue={user.name} required />
                </label>
                <Button type="submit" variant="secondary">Save profile</Button>
              </form>
              <form action={changePassword} className="grid gap-2 rounded-md bg-muted/45 p-3">
                <label className="grid gap-1 text-sm font-medium">
                  <span>Current password</span>
                  <Input name="currentPassword" type="password" required />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  <span>New password</span>
                  <Input name="newPassword" type="password" minLength={12} required />
                </label>
                <Button type="submit" variant="secondary">Change password</Button>
                <p className="text-xs text-muted-foreground">Changing password signs out active sessions. 2FA is not wired yet.</p>
              </form>
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
              <HealthCard icon={Box} label="Backups" value={backupFiles.length ? `${backupFiles.length} file(s)` : "Not wired yet"} note={backupFiles.length ? "Readable backup files found under backups." : "Operator backup scripts exist; no readable files were found."} muted={!backupFiles.length} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><HardDriveDownload className="h-5 w-5 text-water" /> Backup Files</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {backupFiles.length ? backupFiles.map((file) => (
                <div key={file.name} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3">
                  <div>
                    <div className="font-mono text-sm font-semibold text-primary">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{file.modifiedAt.toLocaleString()}</div>
                  </div>
                  <Badge>{Math.ceil(file.size / 1024)} KB</Badge>
                </div>
              )) : <EmptyLine text="No readable backup files found. Use the operator-run backup scripts documented in docs/deployment." />}
              <p className="text-xs text-muted-foreground">Restore remains operator-only; the UI does not run destructive database actions.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Lighting Schedules</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                {lightingSchedules.length ? lightingSchedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-md border border-border bg-background/55 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-primary">{schedule.name}</div>
                        <div className="text-xs text-muted-foreground">{schedule.description ?? "No description yet"}</div>
                      </div>
                      <Badge>{schedule._count.assignments} tanks</Badge>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs">
                      {schedule.points.map((point) => (
                        <div key={point.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/45 px-2 py-1">
                          <span className="font-mono">{point.timeOfDay}</span>
                          <span className="font-mono text-muted-foreground">W{point.white} R{point.red} G{point.green} B{point.blue}{point.intensity !== null ? ` · ${point.intensity}%` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : <EmptyLine text="No lighting schedules yet." />}
              </div>
              <form action={createLightingSchedule} className="grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-3">
                <Input name="name" placeholder="Schedule name" required />
                <Input className="md:col-span-2" name="description" placeholder="Description" />
                <Input name="startTime" type="time" defaultValue="10:00" />
                <Input name="startIntensity" type="number" placeholder="Start intensity" defaultValue="35" />
                <Input name="startWhite" type="number" placeholder="Start white" defaultValue="20" />
                <Input name="peakTime" type="time" defaultValue="14:00" />
                <Input name="peakIntensity" type="number" placeholder="Peak intensity" defaultValue="80" />
                <Input name="peakWhite" type="number" placeholder="Peak white" defaultValue="70" />
                <Input name="endTime" type="time" defaultValue="20:00" />
                <Input name="peakRed" type="number" placeholder="Peak red" defaultValue="35" />
                <Input name="peakGreen" type="number" placeholder="Peak green" defaultValue="40" />
                <Input name="peakBlue" type="number" placeholder="Peak blue" defaultValue="70" />
                <Button className="md:col-span-3" type="submit">Add lighting schedule</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

async function getBackupFiles() {
  const backupDir = path.join(process.cwd(), "backups");
  try {
    const entries = await readdir(backupDir);
    const files = await Promise.all(entries.slice(0, 12).map(async (name) => {
      const filePath = path.join(backupDir, name);
      const info = await stat(filePath);
      if (!info.isFile()) return null;
      return { name, size: info.size, modifiedAt: info.mtime };
    }));
    return files.filter(Boolean).sort((a, b) => b!.modifiedAt.getTime() - a!.modifiedAt.getTime()) as { name: string; size: number; modifiedAt: Date }[];
  } catch {
    return [];
  }
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
