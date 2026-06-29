"use client";

import { useEffect, useState } from "react";
import { Fish } from "lucide-react";
import { addInhabitant } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { RegionalStatusBadge } from "@/components/species/RegionalStatusBadge";
import { isConcerningRegionalStatus, isRestrictedRegionalStatus, neverReleaseMessage, regionalStatusWarning } from "@/domains/species/regional-status";
import {
  defaultUnitForItemType,
  displayNameForSpecies,
  getQuantityMin,
  getQuantityStep,
  speciesMatchesItemType,
  speciesPickerLabel
} from "@/domains/inventory/quantity";

type SpeciesOption = {
  id: string;
  commonName: string;
  scientificName?: string | null;
  genus?: string | null;
  species?: string | null;
  category: string;
  salinityMin: number | null;
  salinityMax: number | null;
  regionalStatuses: { status: any; localityLabelSnapshot: string | null }[];
};

export function AddInhabitantForm({
  aquariumId,
  speciesDefinitions,
  sources,
  salinityHabitats,
  canConfirmRestricted
}: {
  aquariumId: string;
  speciesDefinitions: SpeciesOption[];
  sources: { id: string; name: string }[];
  salinityHabitats: string[];
  canConfirmRestricted: boolean;
}) {
  const [itemType, setItemType] = useState("FISH");
  const [speciesDefinitionId, setSpeciesDefinitionId] = useState("");
  const [name, setName] = useState("");
  const [nameAutoFilled, setNameAutoFilled] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [maleCountApprox, setMaleCountApprox] = useState("");
  const [femaleCountApprox, setFemaleCountApprox] = useState("");
  const [speciesCleared, setSpeciesCleared] = useState(false);
  const [regionalConfirmed, setRegionalConfirmed] = useState(false);
  const compatibleSpecies = speciesDefinitions.filter((species) => speciesMatchesItemType(itemType, species.category, { tankInhabitant: true }));
  const selectedSpecies = speciesDefinitions.find((species) => species.id === speciesDefinitionId);
  const regionalStatus = selectedSpecies?.regionalStatuses?.[0];
  const concerning = Boolean(regionalStatus && isConcerningRegionalStatus(regionalStatus.status));
  const restricted = Boolean(regionalStatus && isRestrictedRegionalStatus(regionalStatus.status));

  useEffect(() => {
    if (!speciesDefinitionId) return;
    if (compatibleSpecies.some((species) => species.id === speciesDefinitionId)) return;
    setSpeciesDefinitionId("");
    setRegionalConfirmed(false);
    setSpeciesCleared(true);
  }, [compatibleSpecies, speciesDefinitionId]);

  function chooseSpecies(nextId: string) {
    setSpeciesDefinitionId(nextId);
    setRegionalConfirmed(false);
    setSpeciesCleared(false);
    const nextSpecies = speciesDefinitions.find((species) => species.id === nextId);
    const nextName = displayNameForSpecies(nextSpecies);
    if (nextName && nameAutoFilled) setName(nextName);
  }

  function useSpeciesName() {
    const nextName = displayNameForSpecies(selectedSpecies);
    if (nextName) {
      setName(nextName);
      setNameAutoFilled(true);
    }
  }

  return (
    <form action={addInhabitant} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <label className="grid gap-1 text-sm font-medium">
        <span>Type</span>
        <Select name="itemType" value={itemType} onChange={(event) => { setItemType(event.target.value); setSpeciesCleared(false); }}>
          <option value="FISH">Fish</option>
          <option value="INVERT">Invertebrate</option>
          <option value="PLANT">Plant</option>
          <option value="OTHER">Coral / other</option>
        </Select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        <span>Species definition</span>
        <Select name="speciesDefinitionId" value={speciesDefinitionId} onChange={(event) => chooseSpecies(event.target.value)}>
          <option value="">{speciesPickerLabel(itemType)}</option>
          {compatibleSpecies.map((species) => <option key={species.id} value={species.id}>{species.commonName} · {species.category.toLowerCase()}{species.regionalStatuses[0] && isConcerningRegionalStatus(species.regionalStatuses[0].status) ? ` · ${species.regionalStatuses[0].status.toLowerCase()}` : ""}</option>)}
        </Select>
        <span className="text-xs font-normal text-muted-foreground">Showing {itemType.toLowerCase().replace("invert", "invertebrate")} species compatible with this {salinityHabitats.join(" / ").toLowerCase()} target range.</span>
        {!compatibleSpecies.length ? <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">No compatible species definitions found for this item type and aquarium target habitat.</span> : null}
        {speciesCleared ? <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">Species selection was cleared because it does not match the selected item type.</span> : null}
      </label>
      {concerning && regionalStatus ? <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs"><div className="flex flex-wrap items-center gap-2"><RegionalStatusBadge status={regionalStatus.status} /><span>{selectedSpecies?.commonName}: {regionalStatusWarning(regionalStatus.status, regionalStatus.localityLabelSnapshot)}</span></div><p>{neverReleaseMessage}</p>{restricted ? <label className="flex items-start gap-2"><input type="checkbox" name="regionalStatusConfirmed" checked={regionalConfirmed} onChange={(event) => setRegionalConfirmed(event.target.checked)} disabled={!canConfirmRestricted} /><span>I confirm I am authorized to handle this species and have verified current requirements. {!canConfirmRestricted ? "Collection Owner or Server Admin confirmation is required." : ""}</span></label> : null}</div> : null}
      <label className="grid gap-1 text-sm font-medium">
        <span>Display name</span>
        <Input name="name" placeholder="Display name, e.g. Ember tetra group" value={name} onChange={(event) => { setName(event.target.value); setNameAutoFilled(false); }} required={!speciesDefinitionId} />
        <span className="text-xs font-normal text-muted-foreground">{speciesDefinitionId ? nameAutoFilled ? "Using species name." : "Custom display name." : "Choose a species to fill this automatically, or enter a custom group name."}</span>
        {speciesDefinitionId ? <button type="button" className="w-fit text-xs font-semibold text-primary underline" onClick={useSpeciesName}>Use species name</button> : null}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="quantity" type="number" min={getQuantityMin(itemType)} step={getQuantityStep(itemType)} placeholder="Quantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        <Input name="unit" placeholder="Quantity label" defaultValue={defaultUnitForItemType(itemType) ?? ""} />
      </div>
      {itemType === "FISH" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium"><span>Approx. males</span><Input name="maleCountApprox" type="number" min="0" step="1" value={maleCountApprox} onChange={(event) => setMaleCountApprox(event.target.value)} placeholder="Optional" /></label>
          <label className="grid gap-1 text-sm font-medium"><span>Approx. females</span><Input name="femaleCountApprox" type="number" min="0" step="1" value={femaleCountApprox} onChange={(event) => setFemaleCountApprox(event.target.value)} placeholder="Optional" /></label>
          <p className="text-xs font-normal text-muted-foreground sm:col-span-2">Leave blank when unknown. Fluxpoint derives unsexed fish from quantity minus known male and female counts.</p>
        </div>
      ) : <><input type="hidden" name="maleCountApprox" value="" /><input type="hidden" name="femaleCountApprox" value="" /></>}
      <Select name="sourceId" defaultValue="">
        <option value="">No source/vendor</option>
        {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
      </Select>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="purchasePrice" type="number" step="0.01" placeholder="Purchase price" />
        <Input name="acquiredAt" type="date" />
      </div>
      <Textarea name="notes" placeholder="Acclimation, quarantine, condition, or plant notes" />
      <Button type="submit" disabled={restricted && (!canConfirmRestricted || !regionalConfirmed)}><Fish className="mr-2 h-4 w-4" />Add to tank</Button>
    </form>
  );
}
