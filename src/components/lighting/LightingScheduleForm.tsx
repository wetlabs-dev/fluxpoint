"use client";

import { useMemo, useState } from "react";
import { parseLightChannels, valuesForPoint } from "@/domains/lighting/capabilities";
import { LightingSchedulePreview } from "@/components/lighting/lighting-schedule-preview";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

export function LightingScheduleForm({ action, schedule, profiles }: { action: (data: FormData) => Promise<void>; schedule?: any; profiles: any[] }) {
  const initialProfile = profiles.find((profile) => profile.id === schedule?.capabilityProfileId) ?? profiles[0];
  const [profileId, setProfileId] = useState(initialProfile?.id ?? "");
  const profile = profiles.find((entry) => entry.id === profileId) ?? initialProfile;
  const [pointCount, setPointCount] = useState(schedule?.points?.length || profile?.pointCount || 4);
  const [points, setPoints] = useState(() => Array.from({ length: 8 }, (_, index) => pointSeed(schedule?.points?.[index], index, schedule?.points?.length || initialProfile?.pointCount || 4)));
  const channels = parseLightChannels(profile?.channels);
  const visible = points.slice(0, pointCount);
  const preview = useMemo(() => visible.map((point) => ({ id: String(point.index), timeOfDay: point.time, white: 0, red: 0, green: 0, blue: 0, warmWhite: null, intensity: null, rampMinutes: point.ramp, values: point.values })), [visible]);
  function update(index: number, patch: Partial<(typeof points)[number]>) { setPoints((current) => current.map((point) => point.index === index ? { ...point, ...patch } : point)); }
  function selectProfile(id: string) { const next = profiles.find((entry) => entry.id === id); setProfileId(id); if (!schedule) setPointCount(next?.pointCount ?? 4); }
  return <form action={action} className="mt-3 grid gap-4 rounded-lg bg-muted/35 p-4">
    {schedule ? <input type="hidden" name="id" value={schedule.id} /> : null}
    <label className="grid gap-1"><span className="text-sm font-medium">Schedule name</span><Input name="name" defaultValue={schedule?.name ?? ""} required /></label>
    <label className="grid gap-1"><span className="text-sm font-medium">Description</span><Textarea name="description" defaultValue={schedule?.description ?? ""} /></label>
    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]"><label className="grid gap-1"><span className="text-sm font-medium">Fixture capability</span><Select name="capabilityProfileId" value={profileId} onChange={(event) => selectProfile(event.target.value)}>{profiles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select></label><label className="grid gap-1"><span className="text-sm font-medium">Set points</span><Input name="pointCount" type="number" min="1" max="8" value={pointCount} onChange={(event) => setPointCount(Math.max(1, Math.min(8, Number(event.target.value) || 1)))} /></label></div>
    <LightingSchedulePreview points={preview} profile={profile} />
    <div className="grid gap-3">{visible.map((point, index) => <div key={point.index} className="grid gap-3 rounded-lg border border-border bg-background/70 p-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="grid gap-1"><span className="text-xs font-semibold text-muted-foreground">Time</span><Input name={`point-${index}-time`} type="time" value={point.time} onChange={(event) => update(index, { time: event.target.value })} /></label>
      <label className="grid gap-1"><span className="text-xs font-semibold text-muted-foreground">Ramp to this point (minutes)</span><Input name={`point-${index}-ramp`} type="number" min="0" max="720" step="1" value={point.ramp} onChange={(event) => update(index, { ramp: Number(event.target.value) })} /><span className="text-[11px] text-muted-foreground">Use 0 for immediate, 15 or 30 for common ramps, or enter a custom duration.</span></label>
      {channels.map((channel) => <label key={channel.key} className="grid gap-1"><span className="text-xs font-semibold text-muted-foreground">{channel.label}</span><Input name={`point-${index}-${channel.key}`} type="number" min={channel.min} max={channel.max} step={channel.step} value={Number(point.values[channel.key] ?? 0)} onChange={(event) => update(index, { values: { ...point.values, [channel.key]: Number(event.target.value) } })} /></label>)}
    </div>)}</div>
    <Button type="submit">{schedule ? "Save schedule" : "Add schedule"}</Button>
  </form>;
}

function pointSeed(point: any, index: number, total: number) { return { index, time: point?.timeOfDay ?? defaultTime(index, total), ramp: point?.rampMinutes ?? (index ? 30 : 0), values: point ? valuesForPoint(point) : {} as Record<string, number> }; }
function defaultTime(index: number, total: number) { if (!index) return "08:00"; if (index === total - 1) return "20:00"; return `${String(8 + Math.round(index * 12 / Math.max(total - 1, 1))).padStart(2, "0")}:00`; }
