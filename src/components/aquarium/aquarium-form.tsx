"use client";

import { useMemo, useState } from "react";
import { createAquarium, updateAquarium } from "@/domains/aquariums/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

type AquariumFormProps = {
  aquarium?: {
    id: string;
    name: string;
    generatedName: string | null;
    description: string | null;
    tankType: string;
    volumeGallons: number | null;
    volumeUnit?: "GALLON" | "LITER";
    lengthInches: number | null;
    widthInches: number | null;
    heightInches: number | null;
    location: string | null;
    locationId?: string | null;
    status: string;
    startedAt?: Date | string | null;
    notes: string | null;
    profile?: {
      substrate: string | null;
      lightingType: string | null;
      lightingSchedule: string | null;
      substrateItemId?: string | null;
      lightItemId?: string | null;
      heaterItemId?: string | null;
      filtration: string | null;
      heating: string | null;
      co2: string | null;
      waterSource: string | null;
      targetTemperature: number | null;
      targetPh: number | null;
      targetGh: number | null;
      targetKh: number | null;
      notes: string | null;
    } | null;
  };
};

type SelectOption = { id: string; label: string };

const tankTypes = ["FRESHWATER", "BRACKISH", "SALTWATER", "POND", "QUARANTINE", "GROWOUT", "OTHER"];
const statuses = ["ACTIVE", "PLANNING", "ARCHIVED"];

export function AquariumForm({
  aquarium,
  locations = [],
  substrateItems = [],
  lightItems = [],
  heaterItems = []
}: AquariumFormProps & { locations?: SelectOption[]; substrateItems?: SelectOption[]; lightItems?: SelectOption[]; heaterItems?: SelectOption[] }) {
  const [volumeGallons, setVolumeGallons] = useState(aquarium?.volumeGallons?.toString() ?? "");
  const [volumeUnit, setVolumeUnit] = useState<"GALLON" | "LITER">(aquarium?.volumeUnit ?? "GALLON");
  const [lengthInches, setLengthInches] = useState(aquarium?.lengthInches?.toString() ?? "");
  const [widthInches, setWidthInches] = useState(aquarium?.widthInches?.toString() ?? "");
  const [heightInches, setHeightInches] = useState(aquarium?.heightInches?.toString() ?? "");
  const volumeEstimate = useMemo(() => {
    const length = Number(lengthInches);
    const width = Number(widthInches);
    const height = Number(heightInches);
    if (!length || !width || !height || length <= 0 || width <= 0 || height <= 0) return null;
    return (length * width * height) / 231;
  }, [heightInches, lengthInches, widthInches]);
  const enteredVolume = Number(volumeGallons);
  const estimatedInSelectedUnit = volumeEstimate === null ? null : volumeUnit === "GALLON" ? volumeEstimate : volumeEstimate * 3.785411784;
  const showVolumeTip = estimatedInSelectedUnit !== null && enteredVolume > 0 && Math.abs(estimatedInSelectedUnit - enteredVolume) > (volumeUnit === "GALLON" ? 5 : 19);

  return (
    <form action={aquarium ? updateAquarium : createAquarium} className="grid gap-4 md:grid-cols-2">
      {aquarium ? <input type="hidden" name="id" value={aquarium.id} /> : null}
      <label className="space-y-1">
        <span className="text-sm font-medium">Display name</span>
        <Input name="name" defaultValue={aquarium?.name} required />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">Generated name</span>
        <Input name="generatedName" defaultValue={aquarium?.generatedName ?? ""} />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">Tank type</span>
        <Select name="tankType" defaultValue={aquarium?.tankType ?? "FRESHWATER"}>
          {tankTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </Select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">Status</span>
        <Select name="status" defaultValue={aquarium?.status ?? "ACTIVE"}>
          {statuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </Select>
      </label>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <label className="space-y-1"><span className="text-sm font-medium">Volume</span><Input name="volumeGallons" type="number" step="0.1" value={volumeGallons} onChange={(event) => setVolumeGallons(event.target.value)} /></label>
        <label className="space-y-1"><span className="text-sm font-medium">Unit</span><Select name="volumeUnit" value={volumeUnit} onChange={(event) => setVolumeUnit(event.target.value as "GALLON" | "LITER")}><option value="GALLON">Gallons</option><option value="LITER">Liters</option></Select></label>
      </div>
      <label className="space-y-1">
        <span className="text-sm font-medium">Location</span>
        <Select name="locationId" defaultValue={aquarium?.locationId ?? ""}>
          <option value="">Unplaced</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
        </Select>
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-sm font-medium">Started at</span>
        <Input name="startedAt" type="date" defaultValue={aquarium?.startedAt ? new Date(aquarium.startedAt).toISOString().slice(0, 10) : ""} />
      </label>
      <div className="grid grid-cols-3 gap-3 md:col-span-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Length</span>
          <Input name="lengthInches" type="number" step="0.1" value={lengthInches} onChange={(event) => setLengthInches(event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Width</span>
          <Input name="widthInches" type="number" step="0.1" value={widthInches} onChange={(event) => setWidthInches(event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Height</span>
          <Input name="heightInches" type="number" step="0.1" value={heightInches} onChange={(event) => setHeightInches(event.target.value)} />
        </label>
      </div>
      {volumeEstimate !== null ? (
        <div className="rounded-md border border-border bg-muted/45 p-3 text-sm md:col-span-2">
          <div className="font-mono font-semibold text-primary">Estimated volume: {estimatedInSelectedUnit?.toFixed(1)} {volumeUnit === "GALLON" ? "gal" : "L"}</div>
          {showVolumeTip ? (
            <p className="mt-1 text-muted-foreground">
              This tank&apos;s dimensions estimate roughly {Math.round(estimatedInSelectedUnit ?? 0)} {volumeUnit === "GALLON" ? "gallons" : "liters"}. Entered volume is {enteredVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} {volumeUnit === "GALLON" ? "gallons" : "liters"}. Verify dimensions or water volume.
            </p>
          ) : null}
        </div>
      ) : null}
      <label className="space-y-1 md:col-span-2">
        <span className="text-sm font-medium">Description</span>
        <Textarea name="description" defaultValue={aquarium?.description ?? ""} />
      </label>
      <div className="md:col-span-2">
        <h3 className="mb-2 font-semibold text-primary">Tank profile</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Select name="substrateItemId" defaultValue={aquarium?.profile?.substrateItemId ?? ""}>
            <option value="">No substrate selected</option>
            {substrateItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
          <Select name="lightItemId" defaultValue={aquarium?.profile?.lightItemId ?? ""}>
            <option value="">No light selected</option>
            {lightItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
          <Select name="heaterItemId" defaultValue={aquarium?.profile?.heaterItemId ?? ""}>
            <option value="">No heater selected</option>
            {heaterItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
          <Input name="filtration" placeholder="Filtration" defaultValue={aquarium?.profile?.filtration ?? ""} />
          <Input name="waterSource" placeholder="Water source" defaultValue={aquarium?.profile?.waterSource ?? ""} />
          <Input name="targetTemperature" type="number" step="0.1" placeholder="Target temperature" defaultValue={aquarium?.profile?.targetTemperature ?? ""} />
          <Input name="targetPh" type="number" step="0.1" placeholder="Target pH" defaultValue={aquarium?.profile?.targetPh ?? ""} />
          <Input name="targetGh" type="number" step="0.1" placeholder="Target GH" defaultValue={aquarium?.profile?.targetGh ?? ""} />
          <Input name="targetKh" type="number" step="0.1" placeholder="Target KH" defaultValue={aquarium?.profile?.targetKh ?? ""} />
        </div>
      </div>
      <label className="space-y-1 md:col-span-2">
        <span className="text-sm font-medium">Aquarium notes</span>
        <Textarea name="notes" defaultValue={aquarium?.notes ?? ""} />
      </label>
      <div className="md:col-span-2">
        <Button type="submit">{aquarium ? "Save aquarium" : "Create aquarium"}</Button>
      </div>
    </form>
  );
}
