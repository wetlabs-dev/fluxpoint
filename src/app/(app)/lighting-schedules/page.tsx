import { Lightbulb } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { createLightingSchedule, deleteLightingSchedule, updateLightingSchedule } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function LightingSchedulesPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const schedules = await prisma.lightingSchedule.findMany({
    where: { collectionId: collection.id },
    include: { points: { orderBy: { sortOrder: "asc" } }, _count: { select: { assignments: true } } },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Lighting Schedules" eyebrow="Template library" />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="grid gap-4">
          {schedules.length ? schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-water" /> {schedule.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{schedule.description ?? "No description yet"}</p>
                  </div>
                  <Badge>{schedule._count.assignments} tanks</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm md:grid-cols-3">
                  {schedule.points.map((point) => (
                    <div key={point.id} className="rounded-md bg-muted/45 p-3">
                      <div className="font-mono font-semibold text-primary">{point.timeOfDay}</div>
                      <div className="font-mono text-xs text-muted-foreground">W{point.white} R{point.red} G{point.green} B{point.blue}{point.intensity !== null ? ` · ${point.intensity}%` : ""}</div>
                    </div>
                  ))}
                </div>
                <details className="rounded-md border border-border bg-background/45 p-3">
                  <summary className="cursor-pointer font-semibold text-primary">Edit schedule</summary>
                  <LightingScheduleForm action={updateLightingSchedule} schedule={schedule} />
                  <form action={deleteLightingSchedule} className="mt-3">
                    <input type="hidden" name="id" value={schedule.id} />
                    <Button type="submit" variant="secondary">Delete schedule</Button>
                  </form>
                </details>
              </CardContent>
            </Card>
          )) : <Card><CardContent className="p-8 text-center text-muted-foreground">No lighting schedules yet.</CardContent></Card>}
        </section>
        <Card>
          <CardHeader><CardTitle>Create schedule</CardTitle></CardHeader>
          <CardContent><LightingScheduleForm action={createLightingSchedule} /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function LightingScheduleForm({ action, schedule }: { action: (formData: FormData) => Promise<void>; schedule?: any }) {
  const start = schedule?.points?.[0];
  const peak = schedule?.points?.[1];
  const end = schedule?.points?.[2];
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-3">
      {schedule ? <input type="hidden" name="id" value={schedule.id} /> : null}
      <Input name="name" placeholder="Schedule name" defaultValue={schedule?.name ?? ""} required />
      <Input className="md:col-span-2" name="description" placeholder="Description" defaultValue={schedule?.description ?? ""} />
      <Input name="startTime" type="time" defaultValue={start?.timeOfDay ?? "10:00"} />
      <Input name="startIntensity" type="number" placeholder="Start intensity" defaultValue={start?.intensity ?? "35"} />
      <Input name="startWhite" type="number" placeholder="Start white" defaultValue={start?.white ?? "20"} />
      <Input name="peakTime" type="time" defaultValue={peak?.timeOfDay ?? "14:00"} />
      <Input name="peakIntensity" type="number" placeholder="Peak intensity" defaultValue={peak?.intensity ?? "80"} />
      <Input name="peakWhite" type="number" placeholder="Peak white" defaultValue={peak?.white ?? "70"} />
      <Input name="endTime" type="time" defaultValue={end?.timeOfDay ?? "20:00"} />
      <Input name="peakRed" type="number" placeholder="Peak red" defaultValue={peak?.red ?? "35"} />
      <Input name="peakGreen" type="number" placeholder="Peak green" defaultValue={peak?.green ?? "40"} />
      <Input name="peakBlue" type="number" placeholder="Peak blue" defaultValue={peak?.blue ?? "70"} />
      <Button className="md:col-span-3" type="submit">{schedule ? "Save schedule" : "Add schedule"}</Button>
    </form>
  );
}
