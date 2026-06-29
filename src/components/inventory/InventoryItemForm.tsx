"use client";

import { useEffect, useState } from "react";
import { createItem, updateItem } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { habitatsForSalinity, speciesMatchesAquariumTarget } from "@/domains/species/habitat";
import { isConcerningRegionalStatus, isRestrictedRegionalStatus, neverReleaseMessage, regionalStatusWarning } from "@/domains/species/regional-status";
import { RegionalStatusBadge } from "@/components/species/RegionalStatusBadge";
import {
  displayNameForSpecies,
  getQuantityMin,
  getQuantityStep,
  isBiologicalItemType,
  speciesMatchesItemType,
  speciesPickerLabel
} from "@/domains/inventory/quantity";
import { fishUnsexedCount, formatFishSexBreakdown } from "@/domains/inventory/fish-sex";

const itemTypes = ["FISH", "INVERT", "PLANT", "SUBSTRATE", "HARDSCAPE", "EQUIPMENT", "BOTANICAL", "FOOD", "MEDICATION", "ADDITIVE", "OTHER"];
const statuses = ["ACTIVE", "IN_AQUARIUM", "IN_STORAGE", "IN_QUARANTINE", "ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"];

export function InventoryItemForm({ aquariums, storageLocations, quarantineProjects, species, sources, item, defaultType, defaultAquariumId, canConfirmRestricted = false }: any) {
  const initialPlacement = item?.aquariumId || defaultAquariumId ? "AQUARIUM" : item?.quarantineProjectId ? "QUARANTINE" : item?.storageLocationId ? "STORAGE" : "UNASSIGNED";
  const [placement, setPlacement] = useState(initialPlacement);
  const [selectedType, setSelectedType] = useState(item?.itemType ?? (itemTypes.includes(defaultType) ? defaultType : "FISH"));
  const [selectedAquariumId, setSelectedAquariumId] = useState(item?.aquariumId ?? defaultAquariumId ?? "");
  const [selectedSpeciesId, setSelectedSpeciesId] = useState(item?.speciesDefinitionId ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [nameAutoFilled, setNameAutoFilled] = useState(!item?.name);
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [maleCountApprox, setMaleCountApprox] = useState(item?.maleCountApprox == null ? "" : String(item.maleCountApprox));
  const [femaleCountApprox, setFemaleCountApprox] = useState(item?.femaleCountApprox == null ? "" : String(item.femaleCountApprox));
  const [speciesCleared, setSpeciesCleared] = useState(false);
  const [regionalConfirmed, setRegionalConfirmed] = useState(false);
  const selectedAquarium = aquariums.find((aquarium: any) => aquarium.id === selectedAquariumId);
  const compatibleSpecies = selectedAquarium
    ? species.filter((definition: any) => speciesMatchesItemType(selectedType, definition.category) && (speciesMatchesAquariumTarget(selectedAquarium.targetSalinityMinPpt, selectedAquarium.targetSalinityMaxPpt, definition.salinityMin, definition.salinityMax) || definition.id === item?.speciesDefinitionId))
    : species.filter((definition: any) => speciesMatchesItemType(selectedType, definition.category));
  const currentSpecies = species.find((definition: any) => definition.id === item?.speciesDefinitionId);
  const selectedSpecies = species.find((definition: any) => definition.id === selectedSpeciesId);
  const regionalStatus = selectedSpecies?.regionalStatuses?.[0];
  const concerning = Boolean(regionalStatus && isConcerningRegionalStatus(regionalStatus.status));
  const restricted = Boolean(regionalStatus && isRestrictedRegionalStatus(regionalStatus.status));
  const incompatibleCurrent = Boolean(selectedAquarium && currentSpecies && !speciesMatchesAquariumTarget(selectedAquarium.targetSalinityMinPpt, selectedAquarium.targetSalinityMaxPpt, currentSpecies.salinityMin, currentSpecies.salinityMax));
  const showSpeciesPicker = isBiologicalItemType(selectedType);

  useEffect(() => {
    if (!selectedSpeciesId) return;
    if (compatibleSpecies.some((definition: any) => definition.id === selectedSpeciesId)) return;
    setSelectedSpeciesId("");
    setRegionalConfirmed(false);
    setSpeciesCleared(true);
  }, [compatibleSpecies, selectedSpeciesId]);

  function chooseSpecies(speciesId: string) {
    setSelectedSpeciesId(speciesId);
    setRegionalConfirmed(false);
    setSpeciesCleared(false);
    const nextSpecies = species.find((definition: any) => definition.id === speciesId);
    const nextName = displayNameForSpecies(nextSpecies);
    if (nextName && nameAutoFilled) {
      setName(nextName);
      setNameAutoFilled(true);
    }
  }

  function useSpeciesName() {
    const nextName = displayNameForSpecies(selectedSpecies);
    if (nextName) {
      setName(nextName);
      setNameAutoFilled(true);
    }
  }

  return <form action={item ? updateItem : createItem} data-testid={item ? `inventory-edit-form-${item.id}` : "inventory-create-form"} className="mt-3 grid gap-6">
    {item ? <input type="hidden" name="id" value={item.id} /> : null}
    <FormSection title="Identity" description="What this item is and how it is tracked.">
      <Field label="Item type"><Select name="itemType" value={selectedType} onChange={(event) => { setSelectedType(event.target.value); setSpeciesCleared(false); }}>{itemTypes.map((type) => <option key={type}>{type}</option>)}</Select></Field>
      <Field label="Status"><Select name="status" defaultValue={item?.status ?? "ACTIVE"}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select></Field>
      <Field label="Name">
        <Input name="name" value={name} onChange={(event) => { setName(event.target.value); setNameAutoFilled(false); }} required={!selectedSpeciesId} />
        <span className="text-xs text-muted-foreground">{selectedSpeciesId ? nameAutoFilled ? "Using species name." : "Custom display name." : "Add a display name, or choose a species to fill it."}</span>
        {selectedSpeciesId ? <button type="button" className="w-fit text-xs font-semibold text-primary underline" onClick={useSpeciesName}>Use species name</button> : null}
      </Field>
      {showSpeciesPicker ? (
        <Field label="Species definition">
          <Select name="speciesDefinitionId" value={selectedSpeciesId} onChange={(event) => chooseSpecies(event.target.value)}>
            <option value="">{speciesPickerLabel(selectedType)}</option>
            {compatibleSpecies.map((definition: any) => <option key={definition.id} value={definition.id}>{definition.commonName}{definition.regionalStatuses?.[0] && isConcerningRegionalStatus(definition.regionalStatuses[0].status) ? ` · ${definition.regionalStatuses[0].status.toLowerCase()}` : ""}</option>)}
          </Select>
          <span className="text-xs text-muted-foreground">Select a species definition when possible. Fluxpoint uses it for compatibility, husbandry, labels, and history.</span>
          {selectedAquarium ? <span className="text-xs text-muted-foreground">Species are filtered for {habitatsForSalinity(selectedAquarium.targetSalinityMinPpt, selectedAquarium.targetSalinityMaxPpt).join(" / ").toLowerCase()} compatibility.</span> : null}
          {!compatibleSpecies.length ? <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">No compatible species definitions found for this item type and aquarium target habitat. Create one from the Species page.</span> : null}
          {speciesCleared ? <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">Species selection was cleared because it does not match the selected item type.</span> : null}
          {incompatibleCurrent ? <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">Current species does not match the selected aquarium’s target salinity range.</span> : null}
        </Field>
      ) : <input type="hidden" name="speciesDefinitionId" value="" />}
      {concerning ? <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 sm:col-span-2"><RegionalStatusBadge status={regionalStatus.status} /><p className="text-sm font-semibold">{regionalStatusWarning(regionalStatus.status, regionalStatus.localityLabelSnapshot)}</p><p className="text-xs">{neverReleaseMessage}</p>{restricted ? <label className="flex items-start gap-2"><input type="checkbox" name="regionalStatusConfirmed" checked={regionalConfirmed} onChange={(event) => setRegionalConfirmed(event.target.checked)} disabled={!canConfirmRestricted} /><span className="text-xs font-semibold">I confirm I am authorized to handle this species and have verified current local requirements. {!canConfirmRestricted ? "A Collection Owner or Server Admin must complete this action." : ""}</span></label> : null}</div> : null}
    </FormSection>
    <FormSection title="Placement" description="Choose one destination; only relevant controls are shown.">
      <Field label="Placement"><Select value={placement} onChange={(event) => setPlacement(event.target.value)}><option value="UNASSIGNED">Unassigned</option><option value="AQUARIUM">Aquarium</option><option value="STORAGE">Storage</option><option value="QUARANTINE">Quarantine</option></Select></Field>
      {placement === "AQUARIUM" ? <Field label="Aquarium"><Select name="aquariumId" value={selectedAquariumId} onChange={(event) => setSelectedAquariumId(event.target.value)}><option value="">Choose aquarium</option>{aquariums.map((a: any) => <option key={a.id} value={a.id}>{a.generatedName ?? a.name} · {habitatsForSalinity(a.targetSalinityMinPpt, a.targetSalinityMaxPpt).join(" / ").toLowerCase()}</option>)}</Select></Field> : <input type="hidden" name="aquariumId" value="" />}
      {placement === "STORAGE" ? <Field label="Storage location"><Select name="storageLocationId" defaultValue={item?.storageLocationId ?? ""}><option value="">Choose location</option>{storageLocations.map((location: any) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select></Field> : <input type="hidden" name="storageLocationId" value="" />}
      {placement === "QUARANTINE" ? <Field label="Quarantine project"><Select name="quarantineProjectId" defaultValue={item?.quarantineProjectId ?? ""}><option value="">Choose project</option>{quarantineProjects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field> : <input type="hidden" name="quarantineProjectId" value="" />}
    </FormSection>
    <FormSection title="Acquisition"><Field label="Source or vendor"><Select name="sourceId" defaultValue={item?.sourceId ?? ""}><option value="">No source/vendor</option>{sources.map((source: any) => <option key={source.id} value={source.id}>{source.name}</option>)}</Select></Field><Field label="Acquired date"><Input name="acquiredAt" type="date" defaultValue={item?.acquiredAt ? new Date(item.acquiredAt).toISOString().slice(0,10) : ""} /></Field><Field label="Purchase price"><Input name="purchasePrice" type="number" step="0.01" defaultValue={item?.purchasePrice ?? ""} /></Field></FormSection>
    <FormSection title="Quantity"><Field label="Quantity" help="Example: 6"><Input name="quantity" type="number" min={getQuantityMin(selectedType)} step={getQuantityStep(selectedType, item?.unit)} className="max-w-36" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><Field label="Quantity label" help="Examples: fish, shrimp, stems, pots, bags, or bottles."><Input name="unit" defaultValue={item?.unit ?? ""} /></Field>{selectedType === "FISH" ? <FishSexFields quantity={quantity} maleCountApprox={maleCountApprox} femaleCountApprox={femaleCountApprox} onMale={setMaleCountApprox} onFemale={setFemaleCountApprox} /> : <><input type="hidden" name="maleCountApprox" value="" /><input type="hidden" name="femaleCountApprox" value="" /></>}</FormSection>
    <FormSection title="Notes"><Field label="Description"><Input name="description" defaultValue={item?.description ?? ""} /></Field><Field label="Notes" wide><Textarea name="notes" defaultValue={item?.notes ?? ""} /></Field></FormSection>
    <Button type="submit" disabled={restricted && (!canConfirmRestricted || !regionalConfirmed)}>{item ? "Save item" : "Create item"}</Button>
  </form>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="grid gap-3 rounded-lg border border-border bg-background/45 p-4 sm:grid-cols-2"><div className="sm:col-span-2"><h3 className="font-semibold text-primary">{title}</h3>{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}</div>{children}</section>; }
function Field({ label, help, wide, children }: { label: string; help?: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid min-w-0 gap-1 ${wide ? "sm:col-span-2" : ""}`}><span className="text-sm font-medium">{label}</span>{children}{help ? <span className="text-xs text-muted-foreground">{help}</span> : null}</label>; }

function FishSexFields({ quantity, maleCountApprox, femaleCountApprox, onMale, onFemale }: { quantity: string; maleCountApprox: string; femaleCountApprox: string; onMale: (value: string) => void; onFemale: (value: string) => void }) {
  const numericQuantity = Number(quantity);
  const breakdown = formatFishSexBreakdown({
    itemType: "FISH",
    quantity: Number.isFinite(numericQuantity) ? numericQuantity : 0,
    maleCountApprox: maleCountApprox === "" ? null : Number(maleCountApprox),
    femaleCountApprox: femaleCountApprox === "" ? null : Number(femaleCountApprox)
  });
  const unsexed = fishUnsexedCount({
    itemType: "FISH",
    quantity: Number.isFinite(numericQuantity) ? numericQuantity : 0,
    maleCountApprox: maleCountApprox === "" ? null : Number(maleCountApprox),
    femaleCountApprox: femaleCountApprox === "" ? null : Number(femaleCountApprox)
  });
  return <>
    <Field label="Approx. males" help="Optional; leave blank if unknown."><Input name="maleCountApprox" type="number" min="0" step="1" value={maleCountApprox} onChange={(event) => onMale(event.target.value)} /></Field>
    <Field label="Approx. females" help="Optional; leave blank if unknown."><Input name="femaleCountApprox" type="number" min="0" step="1" value={femaleCountApprox} onChange={(event) => onFemale(event.target.value)} /></Field>
    <div className="rounded-md bg-muted/45 p-3 text-xs text-muted-foreground sm:col-span-2">{breakdown ?? "No sex breakdown recorded."}{unsexed != null && unsexed < 0 ? " Male + female counts must not exceed quantity." : ""}</div>
  </>;
}
