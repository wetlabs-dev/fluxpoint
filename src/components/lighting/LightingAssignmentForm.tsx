"use client";

import { useMemo, useState } from "react";
import { assignLightingSchedule } from "@/domains/management/actions";
import { calculateScheduleLightLoad, percentLightLoadChange } from "@/domains/lighting/light-load";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";

export function LightingAssignmentForm({ aquariumId, lights, schedules, assignments }: { aquariumId: string; lights: any[]; schedules: any[]; assignments: any[] }) {
  const initial = assignments[0] ?? null;
  const [lightId, setLightId] = useState(initial?.equipmentItemId ?? lights[0]?.id ?? "");
  const [scheduleId, setScheduleId] = useState(initial?.scheduleId ?? "");
  const light = lights.find((item) => item.id === lightId) ?? null;
  const schedule = schedules.find((item) => item.id === scheduleId) ?? null;
  const current = assignments.find((item) => item.equipmentItemId === lightId)?.schedule ?? null;
  const nextEstimate = useMemo(() => schedule ? calculateScheduleLightLoad(schedule.points, schedule.capabilityProfile, light?.maxLumens) : null, [schedule, light]);
  const currentEstimate = useMemo(() => current ? calculateScheduleLightLoad(current.points, current.capabilityProfile, light?.maxLumens) : null, [current, light]);
  const change = percentLightLoadChange(currentEstimate?.estimatedLumenHours ?? null, nextEstimate?.estimatedLumenHours ?? null);
  const compatibleSchedules = schedules.filter((item) => !light?.capabilityProfileId || item.capabilityProfileId === light.capabilityProfileId);
  return <form action={assignLightingSchedule} className="grid gap-3 rounded-md border border-border bg-background/60 p-3">
    <input type="hidden" name="aquariumId" value={aquariumId} />
    <label className="grid gap-1"><span className="text-sm font-medium">Light fixture</span><Select name="equipmentItemId" value={lightId} onChange={(event) => { setLightId(event.target.value); setScheduleId(""); }} required><option value="">Choose light fixture</option>{lights.map((item) => <option key={item.id} value={item.id}>{item.label}{item.maxLumens ? ` · ${item.maxLumens.toLocaleString()} lm` : ""}</option>)}</Select></label>
    <label className="grid gap-1"><span className="text-sm font-medium">Lighting schedule</span><Select name="scheduleId" value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}><option value="">No lighting schedule</option>{compatibleSchedules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
    {(currentEstimate || nextEstimate) ? <div className="grid gap-2 rounded-md bg-muted/45 p-3 text-xs sm:grid-cols-3"><div><span className="block text-muted-foreground">Current load</span><strong className="font-mono text-primary">{currentEstimate?.displayValue ?? "None"}</strong></div><div><span className="block text-muted-foreground">New load</span><strong className="font-mono text-primary">{nextEstimate?.displayValue ?? "None"}</strong></div>{change !== null ? <div><span className="block text-muted-foreground">Relative change</span><strong className="font-mono text-primary">{change > 0 ? "+" : ""}{change.toFixed(1)}%</strong></div> : null}</div> : null}
    {light && !light.maxLumens ? <p className="text-xs text-muted-foreground">Add max lumens to this fixture to compare estimated lumen-hours. Schedule intensity can still be compared.</p> : null}
    <Textarea name="lightingAssignmentNotes" placeholder="Lighting notes" defaultValue={initial?.notes ?? ""} />
    <Button type="submit">Save lighting assignment</Button>
  </form>;
}
