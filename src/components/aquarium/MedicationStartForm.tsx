"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pill } from "lucide-react";
import { startMedicationCourse } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { convertVolume, volumePair, type VolumeUnit } from "@/lib/units/volume";

type MedicationDefinitionOption = {
  id: string;
  name: string;
  defaultDoseAmount: number | null;
  defaultDoseUnit: string | null;
  dosePerGallons: number | null;
  dosePerVolume: number | null;
  doseVolumeUnit: VolumeUnit;
  repeatIntervalHours: number | null;
  courseLengthDays: number | null;
  waterChangeGuidance: string | null;
  safetyNotes: string | null;
};

export function MedicationStartForm({ aquariumId, conditionId, initialVolumeGallons, initialVolumeUnit = "GALLON", definitions }: { aquariumId: string; conditionId?: string; initialVolumeGallons: number | null; initialVolumeUnit?: VolumeUnit; definitions: MedicationDefinitionOption[] }) {
  const [definitionId, setDefinitionId] = useState("");
  const [volume, setVolume] = useState(initialVolumeGallons?.toString() ?? "");
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(initialVolumeUnit);
  const [actualDose, setActualDose] = useState("");
  const definition = definitions.find((entry) => entry.id === definitionId) ?? null;
  const recommendedDose = useMemo(() => {
    const tankVolume = Number(volume);
    const basis = definition?.dosePerVolume ?? definition?.dosePerGallons;
    if (!definition?.defaultDoseAmount || !basis || !Number.isFinite(tankVolume) || tankVolume <= 0) return null;
    return convertVolume(tankVolume, volumeUnit, definition.doseVolumeUnit) / basis * definition.defaultDoseAmount;
  }, [definition, volume, volumeUnit]);

  useEffect(() => {
    setActualDose(recommendedDose === null ? "" : String(Number(recommendedDose.toFixed(3))));
  }, [definitionId, recommendedDose]);

  return (
    <form action={startMedicationCourse} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      {conditionId ? <><input type="hidden" name="conditionId" value={conditionId} /><p className="rounded-md bg-water/10 p-3 text-xs text-muted-foreground">This course will be linked to the selected condition. Completing medication will not resolve it automatically.</p></> : null}
      <Select name="medicationDefinitionId" required value={definitionId} onChange={(event) => setDefinitionId(event.target.value)}>
        <option value="">Choose medication definition</option>
        {definitions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.defaultDoseAmount && (entry.dosePerVolume ?? entry.dosePerGallons) ? ` · ${entry.defaultDoseAmount}${entry.defaultDoseUnit ?? ""} per ${entry.dosePerVolume ?? entry.dosePerGallons} ${entry.doseVolumeUnit === "LITER" ? "L" : "gal"}` : ""}</option>)}
      </Select>
      {!definitions.length ? <Link className="text-sm font-semibold text-primary underline" href="/medications">Create a medication definition first</Link> : null}
      <Select name="doseType" defaultValue="TREATMENT_START">
        <option value="TREATMENT_START">Start treatment course</option>
        <option value="ONE_OFF">Log one-off dose</option>
      </Select>
      <Input name="title" placeholder="Course or dose title" />
      <Input name="reason" placeholder="Reason" />
      <div className="grid gap-3 sm:grid-cols-4">
        <Input name="tankVolume" type="number" min="0.1" step="0.1" placeholder="Tank volume used" value={volume} onChange={(event) => setVolume(event.target.value)} required />
        <Select name="tankVolumeUnit" value={volumeUnit} onChange={(event) => setVolumeUnit(event.target.value as VolumeUnit)}><option value="GALLON">Gallons</option><option value="LITER">Liters</option></Select>
        <Input name="actualDoseAmount" type="number" min="0.001" step="0.001" placeholder="Actual administered" value={actualDose} onChange={(event) => setActualDose(event.target.value)} required />
        <Input name="actualDoseUnit" placeholder="Dose unit" defaultValue={definition?.defaultDoseUnit ?? ""} key={definition?.id ?? "unit"} required />
      </div>
      {Number(volume) > 0 ? <p className="text-xs text-muted-foreground">Tank volume: {volumePair(Number(volume), volumeUnit).liters.toFixed(1)} L / {volumePair(Number(volume), volumeUnit).gallons.toFixed(1)} gal</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <DoseFact label="Recommended" value={recommendedDose === null ? "Manual dose" : `${Number(recommendedDose.toFixed(3))} ${definition?.defaultDoseUnit ?? ""}`} />
        <DoseFact label="Repeat" value={definition?.repeatIntervalHours ? `Every ${definition.repeatIntervalHours} hours` : "Not specified"} />
        <DoseFact label="Course" value={definition?.courseLengthDays ? `${definition.courseLengthDays} days` : "Not specified"} />
      </div>
      {definition?.waterChangeGuidance ? <p className="rounded-md bg-muted/55 p-3 text-sm text-muted-foreground"><strong className="text-primary">Water changes:</strong> {definition.waterChangeGuidance}</p> : null}
      <Input name="startedAt" type="datetime-local" />
      <Textarea name="doseSchedule" placeholder="Dose schedule notes" />
      <Textarea name="notes" placeholder="Medication notes" />
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"><strong>Verify product label directions before dosing.</strong> Confirm the calculated recommendation, then edit the actual administered amount if needed. {definition?.safetyNotes ?? "Stored values are planning aids, not medical instructions."}</div>
      <Button type="submit" disabled={!definitionId || !volume || !actualDose}><Pill className="mr-2 h-4 w-4" />Confirm and log medication</Button>
    </form>
  );
}

function DoseFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/55 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-sm text-primary">{value}</div></div>;
}
