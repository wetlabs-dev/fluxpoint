import { Lightbulb, Plus, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import {
  createLightCapabilityProfile,
  createLightingSchedule,
  deleteLightCapabilityProfile,
  deleteLightingSchedule,
  duplicateLightingSchedule,
  updateLightCapabilityProfile,
  updateLightingSchedule
} from "@/domains/management/actions";
import { ensureLightCapabilityProfiles, parseLightChannels, valuesForPoint } from "@/domains/lighting/capabilities";
import { LightingSchedulePreview } from "@/components/lighting/lighting-schedule-preview";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { LightingScheduleForm } from "@/components/lighting/LightingScheduleForm";
import { calculateScheduleLightLoad } from "@/domains/lighting/light-load";
import { CreatePanel } from "@/components/forms/CreatePanel";

export const dynamic = "force-dynamic";

const capabilityModes = ["ON_OFF", "DIMMABLE", "RGB", "RGBW", "CUSTOM"];

export default async function LightingSchedulesPage({ searchParams }: { searchParams?: Promise<{ create?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const params = await searchParams;
  await ensureLightCapabilityProfiles(collection.id);
  const profiles = await prisma.lightCapabilityProfile.findMany({
    where: { collectionId: collection.id },
    include: { _count: { select: { equipmentProfiles: true, lightingSchedules: true } } },
    orderBy: { name: "asc" }
  });
  const schedules = await prisma.lightingSchedule.findMany({
    where: { collectionId: collection.id },
    include: {
      capabilityProfile: true,
      points: { orderBy: { sortOrder: "asc" } },
      assignments: { include: { aquarium: true, equipmentItem: { include: { equipmentProfile: true } } } },
      _count: { select: { assignments: true } }
    },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Lighting Schedules" eyebrow="Fixture-aware light design" />
      <CreatePanel title="Create schedule" icon={<Plus className="h-5 w-5 text-water" />} defaultOpen={Boolean(params?.create)}><LightingScheduleForm action={createLightingSchedule} profiles={profiles} /></CreatePanel>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="grid gap-4">
          {schedules.length ? schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-water" /> {schedule.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{schedule.description ?? "No description yet"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{schedule.capabilityProfile?.name ?? "Legacy"}</Badge>
                    <Badge>{schedule._count.assignments} lights</Badge>
                    <Badge>{schedule.rampMinutes} min ramp</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <LightingSchedulePreview points={schedule.points} profile={schedule.capabilityProfile} rampMinutes={schedule.rampMinutes} />
                <ScheduleLoadSummary points={schedule.points} profile={schedule.capabilityProfile} rampMinutes={schedule.rampMinutes} />
                {schedule.assignments.length ? <div className="grid gap-2">{schedule.assignments.map((assignment) => { const estimate = calculateScheduleLightLoad(schedule.points, schedule.capabilityProfile, assignment.equipmentItem?.equipmentProfile ?? null, schedule.rampMinutes); return <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/35 p-3 text-sm"><span><strong className="text-primary">{assignment.equipmentItem?.name ?? "Unlinked light"}</strong> · {assignment.aquarium.name}{!assignment.enabled ? " · disabled" : ""}</span><span className="font-mono text-muted-foreground">{!assignment.enabled ? "Excluded from tank total" : estimate.estimatedLumenHours === null ? "Add lumens or wattage" : `${estimate.displayValue}${estimate.outputMethod === "WATTAGE_ESTIMATED" ? ` · estimated from wattage (${estimate.confidence.toLowerCase()})` : ""}`}</span></div>; })}</div> : null}
                <div className="grid gap-2 text-sm md:grid-cols-3">
                  {schedule.points.map((point) => (
                    <div key={point.id} className="rounded-md bg-muted/45 p-3">
                      <div className="font-mono font-semibold text-primary">{point.timeOfDay}</div>
                      <div className="font-mono text-xs text-muted-foreground">{formatValues(valuesForPoint(point))}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={duplicateLightingSchedule}>
                    <input type="hidden" name="id" value={schedule.id} />
                    <Button type="submit" variant="secondary">Duplicate</Button>
                  </form>
                  <details className="min-w-full rounded-md border border-border bg-background/45 p-3">
                    <summary className="cursor-pointer font-semibold text-primary">Edit schedule</summary>
                    <LightingScheduleForm action={updateLightingSchedule} schedule={schedule} profiles={profiles} />
                    <form action={deleteLightingSchedule} className="mt-3">
                      <input type="hidden" name="id" value={schedule.id} />
                      <Button type="submit" variant="secondary" disabled={schedule._count.assignments > 0}>Delete schedule</Button>
                    </form>
                    {schedule._count.assignments > 0 ? <p className="mt-2 text-xs text-muted-foreground">Assigned schedules are protected from deletion.</p> : null}
                  </details>
                </div>
              </CardContent>
            </Card>
          )) : <Card><CardContent className="p-8 text-center text-muted-foreground">Create your first fixture-aware lighting schedule.</CardContent></Card>}
        </section>
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-water" /> Light capabilities</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {profiles.map((profile) => (
                <details key={profile.id} className="rounded-md border border-border bg-muted/35 p-3">
                  <summary className="cursor-pointer font-semibold text-primary">{profile.name}</summary>
                  <p className="mt-1 text-sm text-muted-foreground">{profile.description ?? "Custom fixture capability."}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{profile._count.equipmentProfiles} lights · {profile._count.lightingSchedules} schedules</p>
                  <CapabilityForm action={updateLightCapabilityProfile} profile={profile} />
                  <form action={deleteLightCapabilityProfile} className="mt-2">
                    <input type="hidden" name="id" value={profile.id} />
                    <Button type="submit" variant="secondary" disabled={profile._count.equipmentProfiles + profile._count.lightingSchedules > 0}>Delete profile</Button>
                  </form>
                </details>
              ))}
              <details className="rounded-md border border-border bg-background/45 p-3">
                <summary className="cursor-pointer font-semibold text-primary">Create custom capability</summary>
                <CapabilityForm action={createLightCapabilityProfile} />
              </details>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function LegacyLightingScheduleForm({ action, schedule, profiles }: { action: (formData: FormData) => Promise<void>; schedule?: any; profiles: any[] }) {
  const selectedProfile = profiles.find((profile) => profile.id === schedule?.capabilityProfileId) ?? profiles[0];
  const channels = parseLightChannels(selectedProfile?.channels);
  const pointCount = schedule?.points?.length || selectedProfile?.pointCount || 3;
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-md bg-muted/45 p-3">
      {schedule ? <input type="hidden" name="id" value={schedule.id} /> : null}
      <Input name="name" placeholder="Schedule name" defaultValue={schedule?.name ?? ""} required />
      <Textarea name="description" placeholder="Description" defaultValue={schedule?.description ?? ""} />
      <div className="grid gap-3 md:grid-cols-[1fr_120px]">
        <Select name="capabilityProfileId" defaultValue={selectedProfile?.id ?? ""}>
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </Select>
        <Input name="pointCount" type="number" min="1" max="8" defaultValue={pointCount} />
      </div>
      <div className="grid gap-3">
        {Array.from({ length: pointCount }, (_, index) => {
          const point = schedule?.points?.[index];
          const values = point ? valuesForPoint(point) : {};
          return (
            <div key={index} className="grid gap-2 rounded-md border border-border bg-background/70 p-3 md:grid-cols-[110px_repeat(4,minmax(0,1fr))]">
              <Input name={`point-${index}-time`} type="time" defaultValue={point?.timeOfDay ?? defaultTime(index, pointCount)} />
              {channels.map((channel) => (
                <label key={channel.key} className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span>{channel.label}</span>
                  <Input name={`point-${index}-${channel.key}`} type="number" min={channel.min} max={channel.max} step={channel.step} defaultValue={Number(values[channel.key] ?? (index === pointCount - 1 ? 0 : channel.max / 2))} />
                </label>
              ))}
            </div>
          );
        })}
      </div>
      <Button type="submit">{schedule ? "Save schedule" : "Add schedule"}</Button>
    </form>
  );
}

function CapabilityForm({ action, profile }: { action: (formData: FormData) => Promise<void>; profile?: any }) {
  return (
    <form action={action} className="mt-3 grid gap-3">
      {profile ? <input type="hidden" name="id" value={profile.id} /> : null}
      <Input name="name" placeholder="Capability name" defaultValue={profile?.name ?? ""} required />
      <Textarea name="description" placeholder="Description" defaultValue={profile?.description ?? ""} />
      <div className="grid gap-3 md:grid-cols-2">
        <Select name="mode" defaultValue={profile?.mode ?? "CUSTOM"}>{capabilityModes.map((mode) => <option key={mode}>{mode}</option>)}</Select>
        <Input name="pointCount" type="number" min="1" max="8" defaultValue={profile?.pointCount ?? 3} />
      </div>
      {!profile ? <Input name="channels" placeholder="channels: intensity, white:White, blue:Blue" /> : null}
      <Button type="submit" variant={profile ? "secondary" : "primary"}>{profile ? "Save profile" : "Create profile"}</Button>
    </form>
  );
}

function defaultTime(index: number, total: number) {
  if (index === 0) return "10:00";
  if (index === total - 1) return "20:00";
  return `${String(12 + index).padStart(2, "0")}:00`;
}

function formatValues(values: Record<string, number>) {
  return Object.entries(values).map(([key, value]) => `${key} ${value}`).join(" · ");
}

function ScheduleLoadSummary({ points, profile, rampMinutes }: { points: any[]; profile: any; rampMinutes: number }) {
  const estimate = calculateScheduleLightLoad(points, profile, undefined, rampMinutes);
  return <div className="rounded-md border border-border bg-muted/35 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Schedule intensity profile</div><div className="mt-1 font-mono font-semibold text-primary">{estimate.equivalentFullOutputHours === null ? "Incomplete schedule" : `${estimate.equivalentFullOutputHours.toFixed(2)} equivalent full-output hours`}</div><p className="mt-1 text-xs text-muted-foreground">Normalized across 24 hours so schedules can be compared before a fixture is assigned.</p></div>;
}
