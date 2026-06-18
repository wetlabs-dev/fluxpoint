import { format, isBefore, startOfToday } from "date-fns";
import { CalendarClock, CheckCircle2, SkipForward } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { completeCareTask, createCareSchedule, skipCareTask } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const scheduleTypes = ["MAINTENANCE", "FEEDING", "DOSING", "TESTING", "EQUIPMENT_SERVICE", "WATER_CHANGE", "OTHER"];
const cadenceTypes = ["DAILY", "WEEKLY", "MONTHLY", "EVERY_N_DAYS", "CUSTOM"];

export default async function SchedulesPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const today = startOfToday();
  const [aquariums, schedules, pendingTasks] = await Promise.all([
    prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    prisma.careSchedule.findMany({
      where: { collectionId: collection.id },
      include: { aquarium: true, tasks: { orderBy: { dueAt: "desc" }, take: 3 } },
      orderBy: [{ enabled: "desc" }, { nextDueAt: "asc" }, { name: "asc" }]
    }),
    prisma.careTask.findMany({
      where: { careSchedule: { collectionId: collection.id }, status: "PENDING" },
      include: { careSchedule: true, aquarium: true },
      orderBy: { dueAt: "asc" },
      take: 40
    })
  ]);
  const dueTasks = pendingTasks.filter((task) => !isBefore(today, task.dueAt));
  const upcomingTasks = pendingTasks.filter((task) => isBefore(today, task.dueAt));

  return (
    <div className="space-y-6">
      <PageHeader title="Care Schedules" eyebrow="Recurring aquarium care" />
      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader><CardTitle>Create schedule</CardTitle></CardHeader>
          <CardContent><ScheduleForm aquariums={aquariums} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Due now</CardTitle></CardHeader>
          <CardContent>
            <TaskList tasks={dueTasks} emptyText="No care tasks due today." />
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
          <CardContent><TaskList tasks={upcomingTasks.slice(0, 12)} emptyText="No upcoming generated tasks yet." /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Schedules</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {schedules.length ? schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-md border border-border bg-background/55 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-primary">{schedule.name}</div>
                    <div className="text-sm text-muted-foreground">{schedule.aquarium?.generatedName ?? schedule.aquarium?.name ?? "Collection-wide"} · {schedule.description ?? "No description"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{schedule.scheduleType}</Badge>
                    <Badge>{schedule.cadenceType}</Badge>
                  </div>
                </div>
                <div className="mt-2 font-mono text-xs text-muted-foreground">
                  next due {schedule.nextDueAt ? format(schedule.nextDueAt, "MMM d, yyyy") : "not generated"} · {schedule.enabled ? "enabled" : "disabled"}
                </div>
              </div>
            )) : <Empty text="Create the first recurring care schedule." />}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ScheduleForm({ aquariums }: { aquariums: { id: string; name: string; generatedName: string | null }[] }) {
  return (
    <form action={createCareSchedule} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        <span>Name</span>
        <Input name="name" placeholder="Weekly water change" required />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        <span>Aquarium</span>
        <Select name="aquariumId" defaultValue="">
          <option value="">Collection-wide</option>
          {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
        </Select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          <span>Type</span>
          <Select name="scheduleType" defaultValue="MAINTENANCE">{scheduleTypes.map((type) => <option key={type}>{type}</option>)}</Select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <span>Cadence</span>
          <Select name="cadenceType" defaultValue="WEEKLY">{cadenceTypes.map((type) => <option key={type}>{type}</option>)}</Select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          <span>Start date</span>
          <Input name="startDate" type="date" required />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <span>End date</span>
          <Input name="endDate" type="date" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          <span>Interval days</span>
          <Input name="intervalDays" type="number" min="1" placeholder="For EVERY_N_DAYS" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <span>Day of month</span>
          <Input name="dayOfMonth" type="number" min="1" max="28" placeholder="For MONTHLY" />
        </label>
      </div>
      <Textarea name="description" placeholder="Instructions, amount, or care context" />
      <Button type="submit">Create schedule</Button>
    </form>
  );
}

function TaskList({
  tasks,
  emptyText
}: {
  tasks: {
    id: string;
    title: string;
    description: string | null;
    dueAt: Date;
    aquarium: { name: string; generatedName: string | null } | null;
    careSchedule: { scheduleType: string; cadenceType: string };
  }[];
  emptyText: string;
}) {
  if (!tasks.length) return <Empty text={emptyText} />;
  const today = startOfToday();
  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const overdue = isBefore(task.dueAt, today);
        return (
          <div key={task.id} className="rounded-md border border-border bg-background/55 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-primary">{task.title}</div>
                <div className="text-sm text-muted-foreground">{task.aquarium?.generatedName ?? task.aquarium?.name ?? "Collection-wide"} · due {format(task.dueAt, "MMM d, yyyy")}</div>
                {task.description ? <p className="mt-1 text-sm text-muted-foreground">{task.description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={overdue ? "bg-rose-100 text-rose-950 dark:bg-rose-900/35 dark:text-rose-100" : ""}>{overdue ? "overdue" : task.careSchedule.scheduleType}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={completeCareTask}>
                <input type="hidden" name="id" value={task.id} />
                <Button type="submit" variant="secondary"><CheckCircle2 className="mr-2 h-4 w-4" />Complete</Button>
              </form>
              <form action={skipCareTask}>
                <input type="hidden" name="id" value={task.id} />
                <Button type="submit" variant="ghost"><SkipForward className="mr-2 h-4 w-4" />Skip</Button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      <CalendarClock className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
      {text}
    </div>
  );
}
