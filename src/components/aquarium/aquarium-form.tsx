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
  lightItems = []
}: AquariumFormProps & { locations?: SelectOption[]; substrateItems?: SelectOption[]; lightItems?: SelectOption[] }) {
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
      <label className="space-y-1">
        <span className="text-sm font-medium">Volume gallons</span>
        <Input name="volumeGallons" type="number" step="0.5" defaultValue={aquarium?.volumeGallons ?? ""} />
      </label>
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
          <Input name="lengthInches" type="number" step="0.1" defaultValue={aquarium?.lengthInches ?? ""} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Width</span>
          <Input name="widthInches" type="number" step="0.1" defaultValue={aquarium?.widthInches ?? ""} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Height</span>
          <Input name="heightInches" type="number" step="0.1" defaultValue={aquarium?.heightInches ?? ""} />
        </label>
      </div>
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
          <Input name="temporaryLightingNotes" placeholder="Temporary lighting notes" defaultValue={aquarium?.profile?.lightingSchedule ?? ""} />
          <Input name="filtration" placeholder="Filtration" defaultValue={aquarium?.profile?.filtration ?? ""} />
          <Input name="heating" placeholder="Heating" defaultValue={aquarium?.profile?.heating ?? ""} />
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
