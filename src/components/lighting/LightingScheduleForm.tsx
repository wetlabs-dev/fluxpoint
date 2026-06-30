"use client";

import { useMemo, useState } from "react";
import { parseLightChannels, valuesForPoint } from "@/domains/lighting/capabilities";
import { LightingSchedulePreview } from "@/components/lighting/lighting-schedule-preview";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { calculateScheduleLightLoad, percentLightLoadChange } from "@/domains/lighting/light-load";

export function LightingScheduleForm({ action, schedule, profiles }: { action: (data: FormData) => Promise<void>; schedule?: any; profiles: any[] }) {
  const initialProfile = profiles.find((profile) => profile.id === schedule?.capabilityProfileId) ?? profiles[0];
  const [profileId, setProfileId] = useState(initialProfile?.id ?? "");
  const profile = profiles.find((entry) => entry.id === profileId) ?? initialProfile;
  const [pointCount, setPointCount] = useState(schedule?.points?.length || profile?.pointCount || 4);
  const initialRamp = schedule?.rampMinutes ?? schedule?.points?.find((point: any) => Number(point?.rampMinutes ?? 0) > 0)?.rampMinutes ?? 30;
  const [rampMinutes, setRampMinutes] = useState(Number(initialRamp));
  const [rampPreset, setRampPreset] = useState(["0", "15", "30"].includes(String(initialRamp)) ? String(initialRamp) : "custom");
  const [points, setPoints] = useState(() => Array.from({ length: 8 }, (_, index) => pointSeed(schedule?.points?.[index], index, schedule?.points?.length || initialProfile?.pointCount || 4)));
  const channels = parseLightChannels(profile?.channels);
  const visible = points.slice(0, pointCount);
  const preview = useMemo(() => visible.map((point) => ({ id: String(point.index), timeOfDay: point.time, white: 0, red: 0, green: 0, blue: 0, warmWhite: null, intensity: null, values: point.values })), [visible]);
  const nextEstimate = useMemo(() => calculateScheduleLightLoad(preview, profile, undefined, rampMinutes), [preview, profile, rampMinutes]);
  const previousEstimate = useMemo(() => schedule?.points?.length ? calculateScheduleLightLoad(schedule.points, initialProfile, undefined, schedule.rampMinutes) : null, [schedule, initialProfile]);
  const change = percentLightLoadChange(previousEstimate?.equivalentFullOutputHours ?? null, nextEstimate.equivalentFullOutputHours);
  function update(index: number, patch: Partial<(typeof points)[number]>) { setPoints((current) => current.map((point) => point.index === index ? { ...point, ...patch } : point)); }
  function selectProfile(id: string) { const next = profiles.find((entry) => entry.id === id); setProfileId(id); if (!schedule) setPointCount(next?.pointCount ?? 4); }
  function updateRampPreset(value: string) {
    setRampPreset(value);
    if (value !== "custom") setRampMinutes(Number(value));
  }
  return <form action={action} className="mt-3 grid gap-5 rounded-lg border border-border bg-muted/25 p-4">
    {schedule ? <input type="hidden" name="id" value={schedule.id} /> : null}
    <input type="hidden" name="rampMinutes" value={rampMinutes} />
    <section className="grid gap-3 rounded-md bg-background/55 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Schedule</div>
      <label className="grid gap-1"><span className="text-sm font-medium">Name</span><Input name="name" defaultValue={schedule?.name ?? ""} required /></label>
      <label className="grid gap-1"><span className="text-sm font-medium">Description</span><Textarea name="description" defaultValue={schedule?.description ?? ""} /></label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_12rem]">
        <label className="grid gap-1"><span className="text-sm font-medium">Fixture profile</span><Select name="capabilityProfileId" value={profileId} onChange={(event) => selectProfile(event.target.value)}>{profiles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select></label>
        <label className="grid gap-1"><span className="text-sm font-medium">Points</span><Input name="pointCount" type="number" min="1" max="8" value={pointCount} onChange={(event) => setPointCount(Math.max(1, Math.min(8, Number(event.target.value) || 1)))} /></label>
        <label className="grid gap-1"><span className="text-sm font-medium">Ramp</span><Select value={rampPreset} onChange={(event) => updateRampPreset(event.target.value)}><option value="0">0 min</option><option value="15">15 min</option><option value="30">30 min</option><option value="custom">Custom</option></Select></label>
      </div>
      {rampPreset === "custom" ? <label className="grid gap-1 sm:max-w-48"><span className="text-sm font-medium">Custom ramp minutes</span><Input type="number" min="0" max="1440" step="1" value={rampMinutes} onChange={(event) => setRampMinutes(Math.max(0, Math.min(1440, Number(event.target.value) || 0)))} /></label> : null}
    </section>
    <section className="grid gap-3 rounded-md border border-border bg-background/55 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview and output</div><p className="text-xs text-muted-foreground">Equivalent full-output hours compare schedules across fixture capabilities.</p></div><div className="flex flex-wrap gap-4 text-sm"><strong className="font-mono text-primary">{nextEstimate.equivalentFullOutputHours?.toFixed(2) ?? "—"} h</strong>{previousEstimate ? <span className="font-mono text-muted-foreground">was {previousEstimate.equivalentFullOutputHours?.toFixed(2) ?? "—"} h</span> : null}{change !== null ? <span className="font-mono font-semibold text-primary">{change > 0 ? "+" : ""}{change.toFixed(1)}%</span> : null}</div></div>
      <LightingSchedulePreview points={preview} profile={profile} rampMinutes={rampMinutes} />
    </section>
    <section className="grid gap-3">
      <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Set points</div><p className="text-xs text-muted-foreground">Set the target output at each time. The schedule-level ramp above is applied uniformly to every transition, including the overnight wrap.</p></div>
      {visible.map((point, index) => <div key={point.index} className="grid gap-3 rounded-md border border-border bg-background/70 p-3 lg:grid-cols-[8rem_minmax(0,1fr)]">
        <div>
          <div className="mb-1 text-xs font-semibold text-primary">Point {index + 1}</div>
          <label className="grid gap-1"><span className="text-[11px] font-semibold text-muted-foreground">Time</span><Input name={`point-${index}-time`} type="time" value={point.time} onChange={(event) => update(index, { time: event.target.value })} /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {channels.map((channel) => <label key={channel.key} className="grid gap-1"><span className="text-[11px] font-semibold text-muted-foreground">{channel.label}</span><Input name={`point-${index}-${channel.key}`} type="number" min={channel.min} max={channel.max} step={channel.step} value={Number(point.values[channel.key] ?? 0)} onChange={(event) => update(index, { values: { ...point.values, [channel.key]: Number(event.target.value) } })} /></label>)}
        </div>
      </div>)}
    </section>
    <Button type="submit">{schedule ? "Save schedule" : "Add schedule"}</Button>
  </form>;
}

function pointSeed(point: any, index: number, total: number) { return { index, time: point?.timeOfDay ?? defaultTime(index, total), values: point ? valuesForPoint(point) : {} as Record<string, number> }; }
function defaultTime(index: number, total: number) { if (!index) return "08:00"; if (index === total - 1) return "20:00"; return `${String(8 + Math.round(index * 12 / Math.max(total - 1, 1))).padStart(2, "0")}:00`; }
