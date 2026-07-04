"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createAquarium, updateAquarium } from "@/domains/aquariums/actions";
import { aquariumEquipmentRoleLabels, aquariumEquipmentRoles, defaultAquariumEquipmentRole } from "@/domains/aquariums/equipment-attachments";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { habitatsForSalinity, salinityRangeForLegacy } from "@/domains/species/habitat";
import { CreateSubmitActions } from "@/components/forms/CreateSubmitActions";

type SelectOption = { id: string; label: string };
type EquipmentOption = SelectOption & { itemType: string; equipmentType?: string | null };
type WaterSourceOption = SelectOption & { sourceType: string };
type WaterRecipeOption = SelectOption & { waterSourceId: string; isActive: boolean; targetPh?: number | null; targetGh?: number | null; targetKh?: number | null; targetTds?: number | null; targetSalinity?: number | null };
type AttachmentRow = { key: number; itemId: string; role: string; notes: string };

type AquariumFormProps = {
  aquarium?: any;
  locations?: SelectOption[];
  equipmentItems?: EquipmentOption[];
  vesselItems?: EquipmentOption[];
  sources?: SelectOption[];
  waterSources?: WaterSourceOption[];
  waterRecipes?: WaterRecipeOption[];
};

const aquariumTypes = [["DISPLAY", "Display"], ["QUARANTINE", "Quarantine"], ["HOSPITAL", "Hospital"], ["POND", "Pond"], ["BREEDING", "Breeding"], ["GROW_OUT", "Grow-out"], ["FRAG", "Frag"], ["HOLDING", "Holding"], ["OTHER", "Other"]] as const;
const statuses = ["ACTIVE", "PLANNING", "ARCHIVED"];

export function AquariumForm({ aquarium, locations = [], equipmentItems = [], vesselItems = [], sources = [], waterSources = [], waterRecipes = [] }: AquariumFormProps) {
  const initialAttachments: AttachmentRow[] = (aquarium?.equipmentAttachments ?? []).filter((attachment: any) => attachment.role !== "AQUARIUM_VESSEL").map((attachment: any, index: number) => ({ key: index, itemId: attachment.itemId, role: attachment.role, notes: attachment.notes ?? "" }));
  const currentVessel = (aquarium?.equipmentAttachments ?? []).find((attachment: any) => attachment.role === "AQUARIUM_VESSEL");
  const [attachments, setAttachments] = useState<AttachmentRow[]>(initialAttachments);
  const [nextAttachmentKey, setNextAttachmentKey] = useState(initialAttachments.length);
  const [waterSourceId, setWaterSourceId] = useState(aquarium?.waterSourceId ?? "");
  const [vesselMode, setVesselMode] = useState(currentVessel ? "keep" : "none");
  const [volumeGallons, setVolumeGallons] = useState(aquarium?.volumeGallons?.toString() ?? "");
  const [volumeUnit, setVolumeUnit] = useState<"GALLON" | "LITER">(aquarium?.volumeUnit ?? "GALLON");
  const [lengthInches, setLengthInches] = useState(aquarium?.lengthInches?.toString() ?? "");
  const [widthInches, setWidthInches] = useState(aquarium?.widthInches?.toString() ?? "");
  const [heightInches, setHeightInches] = useState(aquarium?.heightInches?.toString() ?? "");
  const legacySalinity = aquarium?.salinity ? salinityRangeForLegacy(aquarium.salinity) : { min: 0, max: 0.5 };
  const [targetSalinityMinPpt, setTargetSalinityMinPpt] = useState(String(aquarium?.targetSalinityMinPpt ?? legacySalinity.min));
  const [targetSalinityMaxPpt, setTargetSalinityMaxPpt] = useState(String(aquarium?.targetSalinityMaxPpt ?? legacySalinity.max));
  const salinityHabitats = habitatsForSalinity(targetSalinityMinPpt === "" ? null : Number(targetSalinityMinPpt), targetSalinityMaxPpt === "" ? null : Number(targetSalinityMaxPpt));
  const volumeEstimate = useMemo(() => {
    const [length, width, height] = [lengthInches, widthInches, heightInches].map(Number);
    return length > 0 && width > 0 && height > 0 ? length * width * height / 231 : null;
  }, [heightInches, lengthInches, widthInches]);
  const enteredVolume = Number(volumeGallons);
  const estimatedInSelectedUnit = volumeEstimate === null ? null : volumeUnit === "GALLON" ? volumeEstimate : volumeEstimate * 3.785411784;
  const showVolumeTip = estimatedInSelectedUnit !== null && enteredVolume > 0 && Math.abs(estimatedInSelectedUnit - enteredVolume) > (volumeUnit === "GALLON" ? 5 : 19);
  const filteredWaterRecipes = waterRecipes.filter((recipe) => !waterSourceId || recipe.waterSourceId === waterSourceId);

  function addAttachment() {
    const first = equipmentItems[0];
    setAttachments((current) => [...current, { key: nextAttachmentKey, itemId: first?.id ?? "", role: first ? defaultAquariumEquipmentRole(first.itemType, first.equipmentType) : "OTHER", notes: "" }]);
    setNextAttachmentKey((current) => current + 1);
  }

  function updateAttachment(key: number, patch: Partial<AttachmentRow>) {
    setAttachments((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  return (
    <form action={aquarium ? updateAquarium : createAquarium} className="grid gap-5">
      {aquarium ? <input type="hidden" name="id" value={aquarium.id} /> : null}
      <FormSection title="Identity">
        <Field label="Display name"><Input name="name" defaultValue={aquarium?.name} required /></Field>
        <Field label="Status"><Select name="status" defaultValue={aquarium?.status ?? "ACTIVE"}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select></Field>
        <Field label="Started at"><Input name="startedAt" type="date" defaultValue={aquarium?.startedAt ? new Date(aquarium.startedAt).toISOString().slice(0, 10) : ""} /></Field>
        <Field label="Description" wide><Textarea name="description" defaultValue={aquarium?.description ?? ""} /></Field>
      </FormSection>

      <FormSection title="Physical profile">
        <Field label="Volume"><Input name="volumeGallons" type="number" step="0.1" value={volumeGallons} onChange={(event) => setVolumeGallons(event.target.value)} /></Field>
        <Field label="Unit"><Select name="volumeUnit" value={volumeUnit} onChange={(event) => setVolumeUnit(event.target.value as "GALLON" | "LITER")}><option value="GALLON">Gallons</option><option value="LITER">Liters</option></Select></Field>
        <Field label="Length (in)"><Input name="lengthInches" type="number" step="0.1" value={lengthInches} onChange={(event) => setLengthInches(event.target.value)} /></Field>
        <Field label="Width (in)"><Input name="widthInches" type="number" step="0.1" value={widthInches} onChange={(event) => setWidthInches(event.target.value)} /></Field>
        <Field label="Height (in)"><Input name="heightInches" type="number" step="0.1" value={heightInches} onChange={(event) => setHeightInches(event.target.value)} /></Field>
        {estimatedInSelectedUnit !== null ? <div className="rounded-md bg-muted/50 p-3 text-sm sm:col-span-2"><strong className="font-mono text-primary">Estimated: {estimatedInSelectedUnit.toFixed(1)} {volumeUnit === "GALLON" ? "gal" : "L"}</strong>{showVolumeTip ? <p className="mt-1 text-xs text-muted-foreground">Entered volume differs materially from the dimensional estimate; verify the dimensions or usable water volume.</p> : null}</div> : null}
      </FormSection>

      <FormSection title="Aquarium classification">
        <Field label="Target salinity minimum (ppt)"><Input name="targetSalinityMinPpt" type="number" min="0" step="0.1" value={targetSalinityMinPpt} onChange={(event) => setTargetSalinityMinPpt(event.target.value)} /></Field>
        <Field label="Target salinity maximum (ppt)"><Input name="targetSalinityMaxPpt" type="number" min="0" step="0.1" value={targetSalinityMaxPpt} onChange={(event) => setTargetSalinityMaxPpt(event.target.value)} /></Field>
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/45 p-3 sm:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Derived habitat</span>{salinityHabitats.length ? salinityHabitats.map((habitat) => <Badge key={habitat}>✓ {habitat}</Badge>) : <span className="text-xs text-muted-foreground">Enter a target range.</span>}</div>
        <Field label="Tank type"><Select name="aquariumType" defaultValue={aquarium?.aquariumType ?? "DISPLAY"}>{aquariumTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Field label="Location" wide><Select name="locationId" defaultValue={aquarium?.locationId ?? ""}><option value="">Unplaced</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}</Select></Field>
      </FormSection>

      <FormSection title="Target water profile">
        <Field label="Water source">
          <Select name="waterSourceId" value={waterSourceId} onChange={(event) => setWaterSourceId(event.target.value)}>
            <option value="">No structured source</option>
            {waterSources.map((source) => <option key={source.id} value={source.id}>{source.label} · {source.sourceType.toLowerCase()}</option>)}
          </Select>
        </Field>
        <Field label="Water recipe">
          <Select name="waterRecipeId" defaultValue={aquarium?.waterRecipeId ?? ""}>
            <option value="">No recipe</option>
            {filteredWaterRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}
          </Select>
          {waterSourceId && !filteredWaterRecipes.length ? <Link href="/collection#water-recipes" className="text-xs font-semibold text-primary underline">Create a recipe for this source</Link> : null}
        </Field>
        <input type="hidden" name="waterSource" value={aquarium?.profile?.waterSource ?? ""} />
        <Field label="Temperature"><Input name="targetTemperature" type="number" step="0.1" defaultValue={aquarium?.profile?.targetTemperature ?? ""} /></Field>
        <Field label="Target pH"><Input name="targetPh" type="number" step="0.1" defaultValue={aquarium?.profile?.targetPh ?? ""} /></Field>
        <Field label="Target GH"><Input name="targetGh" type="number" step="0.1" defaultValue={aquarium?.profile?.targetGh ?? ""} /></Field>
        <Field label="Target KH"><Input name="targetKh" type="number" step="0.1" defaultValue={aquarium?.profile?.targetKh ?? ""} /></Field>
        <div className="rounded-md bg-muted/45 p-3 text-xs text-muted-foreground sm:col-span-2">Metric ranges sync when this profile is saved. GH and KH use target ±2 (clamped at zero); ammonia and nitrite default to 0–0 ppm, and nitrate defaults to 0–40 ppm. Dedicated metric overrides remain unchanged.</div>
      </FormSection>

      <section className="grid gap-3 rounded-lg border border-border bg-background/45 p-4">
        <div>
          <h3 className="font-semibold text-primary">Physical tank / vessel</h3>
          <p className="text-xs text-muted-foreground">Optional: represent the glass/acrylic vessel as a reusable equipment inventory item while keeping operational volume and target parameters on the aquarium.</p>
        </div>
        {currentVessel ? <div className="rounded-md bg-muted/50 p-3 text-sm">Current vessel: <strong>{currentVessel.item?.name ?? "Attached vessel"}</strong></div> : null}
        <Select name="vesselMode" value={vesselMode} onChange={(event) => setVesselMode(event.target.value)}>
          {currentVessel ? <option value="keep">Keep current vessel</option> : null}
          <option value="none">No vessel attached</option>
          <option value="attach">Attach existing vessel item</option>
          <option value="create">Create new vessel item</option>
        </Select>
        {vesselMode === "attach" ? (
          <Field label="Existing vessel item">
            <Select name="vesselItemId" defaultValue={currentVessel?.itemId ?? ""}>
              <option value="">Choose a vessel</option>
              {vesselItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
        ) : null}
        {vesselMode === "create" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Vessel name"><Input name="vesselName" placeholder="e.g. 40 breeder glass tank" /></Field>
            <Field label="Brand"><Input name="vesselBrand" /></Field>
            <Field label="Model"><Input name="vesselModel" /></Field>
            <Field label="Source/vendor"><Select name="vesselSourceId"><option value="">No source/vendor</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</Select></Field>
            <Field label="Purchase price"><Input name="vesselPurchasePrice" type="number" min="0" step="0.01" /></Field>
            <Field label="Purchase date"><Input name="vesselPurchaseDate" type="date" /></Field>
            <Field label="Vessel notes" wide><Textarea name="vesselNotes" /></Field>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-background/45 p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-primary">Attached equipment</h3><p className="text-xs text-muted-foreground">Attach any number of owned equipment or substrate items and group them by aquarium role.</p></div><Button type="button" variant="secondary" onClick={addAttachment} disabled={!equipmentItems.length}>Add row</Button></div>
        <input type="hidden" name="equipmentRowCount" value={attachments.length} />
        {attachments.length ? attachments.map((row, index) => (
          <div key={row.key} className="grid gap-2 rounded-md border border-border bg-card/65 p-3 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Select name={`equipment-${index}-role`} value={row.role} onChange={(event) => updateAttachment(row.key, { role: event.target.value })}>{aquariumEquipmentRoles.map((role) => <option key={role} value={role}>{aquariumEquipmentRoleLabels[role]}</option>)}</Select>
            <Select name={`equipment-${index}-itemId`} value={row.itemId} onChange={(event) => { const item = equipmentItems.find((option) => option.id === event.target.value); updateAttachment(row.key, { itemId: event.target.value, role: item ? defaultAquariumEquipmentRole(item.itemType, item.equipmentType) : row.role }); }} required><option value="">Choose an item</option>{equipmentItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>
            <Input name={`equipment-${index}-notes`} value={row.notes} onChange={(event) => updateAttachment(row.key, { notes: event.target.value })} placeholder="Optional role notes" />
            <Button type="button" variant="secondary" onClick={() => setAttachments((current) => current.filter((entry) => entry.key !== row.key))}>Remove</Button>
          </div>
        )) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No equipment attached. You can save the aquarium now and add equipment later.</div>}
      </section>

      <Field label="Aquarium notes"><Textarea name="notes" defaultValue={aquarium?.notes ?? ""} /></Field>
      {aquarium ? <Button type="submit">Save aquarium</Button> : <CreateSubmitActions label="Create aquarium" cancelHref="/aquariums" />}
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="grid gap-3 rounded-lg border border-border bg-background/45 p-4 sm:grid-cols-2"><h3 className="font-semibold text-primary sm:col-span-2">{title}</h3>{children}</section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid min-w-0 gap-1 ${wide ? "sm:col-span-2" : ""}`}><span className="text-sm font-medium">{label}</span>{children}</label>; }
