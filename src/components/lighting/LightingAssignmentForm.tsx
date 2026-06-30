"use client";

import { useMemo, useState } from "react";
import { assignLightingSchedule } from "@/domains/management/actions";
import { calculateScheduleLightLoad, percentLightLoadChange, resolveLightOutput } from "@/domains/lighting/light-load";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";

export function LightingAssignmentForm({ aquariumId, lights, schedules, assignments }: { aquariumId: string; lights: any[]; schedules: any[]; assignments: any[] }) {
  if (!lights.length) return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Attach light equipment to this aquarium before assigning schedules.</p>;
  return <div className="grid gap-3">{lights.map((light) => <LightAssignmentRow key={light.id} aquariumId={aquariumId} light={light} schedules={schedules} assignment={assignments.find((entry) => entry.equipmentItemId === light.id) ?? null} />)}</div>;
}

function LightAssignmentRow({ aquariumId, light, schedules, assignment }: { aquariumId: string; light: any; schedules: any[]; assignment: any }) {
  const [scheduleId, setScheduleId] = useState(assignment?.scheduleId ?? "");
  const schedule = schedules.find((item) => item.id === scheduleId) ?? null;
  const current = assignment?.schedule ?? null;
  const output = resolveLightOutput(light, light.capabilityProfile ?? null);
  const nextEstimate = useMemo(() => schedule ? calculateScheduleLightLoad(schedule.points, schedule.capabilityProfile, light, schedule.rampMinutes) : null, [schedule, light]);
  const currentEstimate = useMemo(() => current ? calculateScheduleLightLoad(current.points, current.capabilityProfile, light, current.rampMinutes) : null, [current, light]);
  const change = percentLightLoadChange(currentEstimate?.estimatedLumenHours ?? null, nextEstimate?.estimatedLumenHours ?? null);
  const compatibleSchedules = schedules.filter((item) => !light.capabilityProfileId || item.capabilityProfileId === light.capabilityProfileId);
  return <form action={assignLightingSchedule} className="grid gap-3 rounded-md border border-border bg-background/60 p-3">
    <input type="hidden" name="aquariumId" value={aquariumId} />
    <input type="hidden" name="equipmentItemId" value={light.id} />
    <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-semibold text-primary">{light.label}</div><div className="text-xs text-muted-foreground">{output.description} · {output.confidence.toLowerCase()} confidence</div></div><label className="flex items-center gap-2 text-sm font-medium"><input name="enabled" type="checkbox" defaultChecked={assignment?.enabled ?? true} /> Enabled</label></div>
    <label className="grid gap-1"><span className="text-sm font-medium">Lighting schedule</span><Select name="scheduleId" value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}><option value="">No lighting schedule</option>{compatibleSchedules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
    {(currentEstimate || nextEstimate) ? <div className="grid gap-2 rounded-md bg-muted/45 p-3 text-xs sm:grid-cols-3"><div><span className="block text-muted-foreground">Current load</span><strong className="font-mono text-primary">{currentEstimate?.displayValue ?? "None"}</strong></div><div><span className="block text-muted-foreground">New load</span><strong className="font-mono text-primary">{nextEstimate?.displayValue ?? "None"}</strong></div>{change !== null ? <div><span className="block text-muted-foreground">Relative change</span><strong className="font-mono text-primary">{change > 0 ? "+" : ""}{change.toFixed(1)}%</strong></div> : null}</div> : null}
    {!output.estimatedMaxLumens ? <p className="text-xs text-muted-foreground">Add max lumens or wattage to this fixture to estimate lumen-hours. Schedule intensity can still be compared.</p> : null}
    <Textarea name="lightingAssignmentNotes" placeholder="Lighting notes" defaultValue={assignment?.notes ?? ""} />
    <Button type="submit">{assignment ? "Save this light" : "Add this light"}</Button>
  </form>;
}
