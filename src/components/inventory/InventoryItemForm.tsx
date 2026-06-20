"use client";

import { useState } from "react";
import { createItem, updateItem } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

const itemTypes = ["FISH", "INVERT", "PLANT", "SUBSTRATE", "HARDSCAPE", "EQUIPMENT", "BOTANICAL", "FOOD", "MEDICATION", "ADDITIVE", "OTHER"];
const statuses = ["ACTIVE", "IN_AQUARIUM", "IN_STORAGE", "IN_QUARANTINE", "ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"];

export function InventoryItemForm({ aquariums, storageLocations, quarantineProjects, species, sources, item, defaultType, defaultAquariumId }: any) {
  const initialPlacement = item?.aquariumId || defaultAquariumId ? "AQUARIUM" : item?.quarantineProjectId ? "QUARANTINE" : item?.storageLocationId ? "STORAGE" : "UNASSIGNED";
  const [placement, setPlacement] = useState(initialPlacement);
  const selectedType = item?.itemType ?? (itemTypes.includes(defaultType) ? defaultType : "FISH");
  return <form action={item ? updateItem : createItem} className="mt-3 grid gap-6">
    {item ? <input type="hidden" name="id" value={item.id} /> : null}
    <FormSection title="Identity" description="What this item is and how it is tracked.">
      <Field label="Item type"><Select name="itemType" defaultValue={selectedType}>{itemTypes.map((type) => <option key={type}>{type}</option>)}</Select></Field>
      <Field label="Status"><Select name="status" defaultValue={item?.status ?? "ACTIVE"}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select></Field>
      <Field label="Name"><Input name="name" defaultValue={item?.name ?? ""} required /></Field>
      <Field label="Species definition"><Select name="speciesDefinitionId" defaultValue={item?.speciesDefinitionId ?? ""}><option value="">No species definition</option>{species.map((definition: any) => <option key={definition.id} value={definition.id}>{definition.commonName}</option>)}</Select></Field>
    </FormSection>
    <FormSection title="Placement" description="Choose one destination; only relevant controls are shown.">
      <Field label="Placement"><Select value={placement} onChange={(event) => setPlacement(event.target.value)}><option value="UNASSIGNED">Unassigned</option><option value="AQUARIUM">Aquarium</option><option value="STORAGE">Storage</option><option value="QUARANTINE">Quarantine</option></Select></Field>
      {placement === "AQUARIUM" ? <Field label="Aquarium"><Select name="aquariumId" defaultValue={item?.aquariumId ?? defaultAquariumId ?? ""}><option value="">Choose aquarium</option>{aquariums.map((a: any) => <option key={a.id} value={a.id}>{a.generatedName ?? a.name}</option>)}</Select></Field> : <input type="hidden" name="aquariumId" value="" />}
      {placement === "STORAGE" ? <Field label="Storage location"><Select name="storageLocationId" defaultValue={item?.storageLocationId ?? ""}><option value="">Choose location</option>{storageLocations.map((location: any) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></Field> : <input type="hidden" name="storageLocationId" value="" />}
      {placement === "QUARANTINE" ? <Field label="Quarantine project"><Select name="quarantineProjectId" defaultValue={item?.quarantineProjectId ?? ""}><option value="">Choose project</option>{quarantineProjects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field> : <input type="hidden" name="quarantineProjectId" value="" />}
    </FormSection>
    <FormSection title="Acquisition"><Field label="Source or vendor"><Select name="sourceId" defaultValue={item?.sourceId ?? ""}><option value="">No source/vendor</option>{sources.map((source: any) => <option key={source.id} value={source.id}>{source.name}</option>)}</Select></Field><Field label="Acquired date"><Input name="acquiredAt" type="date" defaultValue={item?.acquiredAt ? new Date(item.acquiredAt).toISOString().slice(0,10) : ""} /></Field><Field label="Purchase price"><Input name="purchasePrice" type="number" step="0.01" defaultValue={item?.purchasePrice ?? ""} /></Field></FormSection>
    <FormSection title="Quantity"><Field label="Quantity"><Input name="quantity" type="number" step="0.1" className="max-w-36" defaultValue={item?.quantity ?? 1} /></Field><Field label="Quantity label" help="Examples: fish, shrimp, stems, pots, bags, or bottles."><Input name="unit" defaultValue={item?.unit ?? ""} /></Field></FormSection>
    <FormSection title="Notes"><Field label="Description"><Input name="description" defaultValue={item?.description ?? ""} /></Field><Field label="Notes" wide><Textarea name="notes" defaultValue={item?.notes ?? ""} /></Field></FormSection>
    <Button type="submit">{item ? "Save item" : "Create item"}</Button>
  </form>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="grid gap-3 rounded-lg border border-border bg-background/45 p-4 sm:grid-cols-2"><div className="sm:col-span-2"><h3 className="font-semibold text-primary">{title}</h3>{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}</div>{children}</section>; }
function Field({ label, help, wide, children }: { label: string; help?: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid min-w-0 gap-1 ${wide ? "sm:col-span-2" : ""}`}><span className="text-sm font-medium">{label}</span>{children}{help ? <span className="text-xs text-muted-foreground">{help}</span> : null}</label>; }
