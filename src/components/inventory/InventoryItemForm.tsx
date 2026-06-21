"use client";

import { useState } from "react";
import { createItem, updateItem } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { speciesMatchesAquariumSalinity } from "@/domains/species/habitat";
import { isConcerningRegionalStatus, isRestrictedRegionalStatus, neverReleaseMessage, regionalStatusWarning } from "@/domains/species/regional-status";
import { RegionalStatusBadge } from "@/components/species/RegionalStatusBadge";

const itemTypes = ["FISH", "INVERT", "PLANT", "SUBSTRATE", "HARDSCAPE", "EQUIPMENT", "BOTANICAL", "FOOD", "MEDICATION", "ADDITIVE", "OTHER"];
const statuses = ["ACTIVE", "IN_AQUARIUM", "IN_STORAGE", "IN_QUARANTINE", "ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"];

export function InventoryItemForm({ aquariums, storageLocations, quarantineProjects, species, sources, item, defaultType, defaultAquariumId, canConfirmRestricted = false }: any) {
  const initialPlacement = item?.aquariumId || defaultAquariumId ? "AQUARIUM" : item?.quarantineProjectId ? "QUARANTINE" : item?.storageLocationId ? "STORAGE" : "UNASSIGNED";
  const [placement, setPlacement] = useState(initialPlacement);
  const [selectedType, setSelectedType] = useState(item?.itemType ?? (itemTypes.includes(defaultType) ? defaultType : "FISH"));
  const [selectedAquariumId, setSelectedAquariumId] = useState(item?.aquariumId ?? defaultAquariumId ?? "");
  const [selectedSpeciesId, setSelectedSpeciesId] = useState(item?.speciesDefinitionId ?? "");
  const [regionalConfirmed, setRegionalConfirmed] = useState(false);
  const selectedAquarium = aquariums.find((aquarium: any) => aquarium.id === selectedAquariumId);
  const compatibleSpecies = selectedAquarium
    ? species.filter((definition: any) => speciesMatchesAquariumSalinity(selectedAquarium.salinity, definition.salinityMin, definition.salinityMax) || definition.id === item?.speciesDefinitionId)
    : species;
  const currentSpecies = species.find((definition: any) => definition.id === item?.speciesDefinitionId);
  const selectedSpecies = species.find((definition: any) => definition.id === selectedSpeciesId);
  const regionalStatus = selectedSpecies?.regionalStatuses?.[0];
  const concerning = Boolean(regionalStatus && isConcerningRegionalStatus(regionalStatus.status));
  const restricted = Boolean(regionalStatus && isRestrictedRegionalStatus(regionalStatus.status));
  const incompatibleCurrent = Boolean(selectedAquarium && currentSpecies && !speciesMatchesAquariumSalinity(selectedAquarium.salinity, currentSpecies.salinityMin, currentSpecies.salinityMax));
  return <form action={item ? updateItem : createItem} data-testid={item ? `inventory-edit-form-${item.id}` : "inventory-create-form"} className="mt-3 grid gap-6">
    {item ? <input type="hidden" name="id" value={item.id} /> : null}
    <FormSection title="Identity" description="What this item is and how it is tracked.">
      <Field label="Item type"><Select name="itemType" value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>{itemTypes.map((type) => <option key={type}>{type}</option>)}</Select></Field>
      <Field label="Status"><Select name="status" defaultValue={item?.status ?? "ACTIVE"}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select></Field>
      <Field label="Name"><Input name="name" defaultValue={item?.name ?? ""} required /></Field>
      <Field label="Species definition"><Select name="speciesDefinitionId" value={selectedSpeciesId} onChange={(event) => { setSelectedSpeciesId(event.target.value); setRegionalConfirmed(false); }}><option value="">No species definition</option>{compatibleSpecies.map((definition: any) => <option key={definition.id} value={definition.id}>{definition.commonName}{definition.regionalStatuses?.[0] && isConcerningRegionalStatus(definition.regionalStatuses[0].status) ? ` · ${definition.regionalStatuses[0].status.toLowerCase()}` : ""}</option>)}</Select>{selectedAquarium ? <span className="text-xs text-muted-foreground">Species are filtered for {selectedAquarium.salinity.toLowerCase()} compatibility.</span> : null}{incompatibleCurrent ? <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">Current species does not match the selected aquarium’s salinity profile.</span> : null}</Field>
      {concerning ? <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 sm:col-span-2"><RegionalStatusBadge status={regionalStatus.status} /><p className="text-sm font-semibold">{regionalStatusWarning(regionalStatus.status, regionalStatus.localityLabelSnapshot)}</p><p className="text-xs">{neverReleaseMessage}</p>{restricted ? <label className="flex items-start gap-2"><input type="checkbox" name="regionalStatusConfirmed" checked={regionalConfirmed} onChange={(event) => setRegionalConfirmed(event.target.checked)} disabled={!canConfirmRestricted} /><span className="text-xs font-semibold">I confirm I am authorized to handle this species and have verified current local requirements. {!canConfirmRestricted ? "A Collection Owner or Server Admin must complete this action." : ""}</span></label> : null}</div> : null}
    </FormSection>
    <FormSection title="Placement" description="Choose one destination; only relevant controls are shown.">
      <Field label="Placement"><Select value={placement} onChange={(event) => setPlacement(event.target.value)}><option value="UNASSIGNED">Unassigned</option><option value="AQUARIUM">Aquarium</option><option value="STORAGE">Storage</option><option value="QUARANTINE">Quarantine</option></Select></Field>
      {placement === "AQUARIUM" ? <Field label="Aquarium"><Select name="aquariumId" value={selectedAquariumId} onChange={(event) => setSelectedAquariumId(event.target.value)}><option value="">Choose aquarium</option>{aquariums.map((a: any) => <option key={a.id} value={a.id}>{a.generatedName ?? a.name} · {a.salinity.toLowerCase()}</option>)}</Select></Field> : <input type="hidden" name="aquariumId" value="" />}
      {placement === "STORAGE" ? <Field label="Storage location"><Select name="storageLocationId" defaultValue={item?.storageLocationId ?? ""}><option value="">Choose location</option>{storageLocations.map((location: any) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></Field> : <input type="hidden" name="storageLocationId" value="" />}
      {placement === "QUARANTINE" ? <Field label="Quarantine project"><Select name="quarantineProjectId" defaultValue={item?.quarantineProjectId ?? ""}><option value="">Choose project</option>{quarantineProjects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field> : <input type="hidden" name="quarantineProjectId" value="" />}
    </FormSection>
    <FormSection title="Acquisition"><Field label="Source or vendor"><Select name="sourceId" defaultValue={item?.sourceId ?? ""}><option value="">No source/vendor</option>{sources.map((source: any) => <option key={source.id} value={source.id}>{source.name}</option>)}</Select></Field><Field label="Acquired date"><Input name="acquiredAt" type="date" defaultValue={item?.acquiredAt ? new Date(item.acquiredAt).toISOString().slice(0,10) : ""} /></Field><Field label="Purchase price"><Input name="purchasePrice" type="number" step="0.01" defaultValue={item?.purchasePrice ?? ""} /></Field></FormSection>
    <FormSection title="Quantity"><Field label="Quantity"><Input name="quantity" type="number" step="0.1" className="max-w-36" defaultValue={item?.quantity ?? 1} /></Field><Field label="Quantity label" help="Examples: fish, shrimp, stems, pots, bags, or bottles."><Input name="unit" defaultValue={item?.unit ?? ""} /></Field></FormSection>
    <FormSection title="Notes"><Field label="Description"><Input name="description" defaultValue={item?.description ?? ""} /></Field><Field label="Notes" wide><Textarea name="notes" defaultValue={item?.notes ?? ""} /></Field></FormSection>
    <Button type="submit" disabled={restricted && (!canConfirmRestricted || !regionalConfirmed)}>{item ? "Save item" : "Create item"}</Button>
  </form>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="grid gap-3 rounded-lg border border-border bg-background/45 p-4 sm:grid-cols-2"><div className="sm:col-span-2"><h3 className="font-semibold text-primary">{title}</h3>{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}</div>{children}</section>; }
function Field({ label, help, wide, children }: { label: string; help?: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid min-w-0 gap-1 ${wide ? "sm:col-span-2" : ""}`}><span className="text-sm font-medium">{label}</span>{children}{help ? <span className="text-xs text-muted-foreground">{help}</span> : null}</label>; }
