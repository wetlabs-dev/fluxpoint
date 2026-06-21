"use client";

import { useState } from "react";
import { createEquipment, updateEquipment } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

const equipmentTypes = ["HEATER", "LIGHT", "FILTER", "PUMP", "AIR_PUMP", "CO2", "SENSOR", "CONTROLLER", "DOSER", "OTHER"];

export function EquipmentForm({ sources, lightCapabilities, item }: any) {
  const profile = item?.equipmentProfile;
  const [type, setType] = useState(profile?.equipmentType ?? "LIGHT");
  return <form action={item ? updateEquipment : createEquipment} className="mt-4 grid gap-6">
    {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
    <Section title="Identity">
      <Field label="Equipment name" wide><Input name="name" defaultValue={item?.name ?? ""} required /></Field>
      <Field label="Equipment type"><Select name="equipmentType" value={type} onChange={(event) => setType(event.target.value)}>{equipmentTypes.map((value) => <option key={value}>{value}</option>)}</Select></Field>
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">Attach this record to one or more aquariums from each aquarium’s Equipment workspace.</div>
      <Field label="Brand"><Input name="brand" defaultValue={profile?.brand ?? ""} /></Field><Field label="Model"><Input name="model" defaultValue={profile?.model ?? ""} /></Field>
      <Field label="Serial number" wide><Input name="serialNumber" className="font-mono" defaultValue={profile?.serialNumber ?? ""} /></Field>
    </Section>
    {type === "LIGHT" ? <Section title="Light capability" description="Match this fixture to the channels its controller exposes."><Field label="Capability profile" wide><Select name="lightCapabilityProfileId" defaultValue={profile?.lightCapabilityProfileId ?? ""}><option value="">Not a controllable light</option>{lightCapabilities.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Field label="Max lumens" wide><Input name="maxLumens" type="number" min="1" max="999999" step="1" defaultValue={profile?.maxLumens ?? ""} /><span className="text-xs text-muted-foreground">Used to estimate daily light load from lighting schedules. This is a comparative estimate, not PAR.</span></Field></Section> : <input type="hidden" name="lightCapabilityProfileId" value="" />}
    <Section title="Ownership"><Field label="Source or vendor"><Select name="sourceId" className="w-full min-w-0" defaultValue={item?.sourceId ?? ""}><option value="">No source/vendor</option>{sources.map((source: any) => <option key={source.id} value={source.id}>{source.name}</option>)}</Select></Field><Field label="Purchase price"><Input name="purchasePrice" type="number" step="0.01" className="w-full min-w-0" defaultValue={item?.purchasePrice ?? ""} /></Field><Field label="Purchase date"><Input name="purchaseDate" type="date" defaultValue={profile?.purchaseDate ? new Date(profile.purchaseDate).toISOString().slice(0,10) : ""} /></Field></Section>
    <Section title="Warranty"><Field label="Warranty until"><Input name="warrantyUntil" type="date" defaultValue={profile?.warrantyUntil ? new Date(profile.warrantyUntil).toISOString().slice(0,10) : ""} /></Field></Section>
    <Section title="Maintenance"><Field label="Maintenance interval (days)"><Input name="maintenanceIntervalDays" type="number" min="1" defaultValue={profile?.maintenanceIntervalDays ?? ""} /></Field><Field label="Last maintained"><Input name="lastMaintainedAt" type="date" defaultValue={profile?.lastMaintainedAt ? new Date(profile.lastMaintainedAt).toISOString().slice(0,10) : ""} /></Field></Section>
    <Section title="Notes"><Field label="Notes" wide><Textarea name="notes" defaultValue={item?.notes ?? profile?.notes ?? ""} /></Field></Section>
    <Button type="submit">{item ? "Save equipment" : "Create equipment"}</Button>
  </form>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="grid gap-3 rounded-lg border border-border bg-background/45 p-4 sm:grid-cols-2"><div className="sm:col-span-2"><h3 className="font-semibold text-primary">{title}</h3>{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}</div>{children}</section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid min-w-0 gap-1 ${wide ? "sm:col-span-2" : ""}`}><span className="text-sm font-medium">{label}</span>{children}</label>; }
