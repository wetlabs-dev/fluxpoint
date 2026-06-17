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
    status: string;
    notes: string | null;
  };
};

const tankTypes = ["FRESHWATER", "BRACKISH", "SALTWATER", "POND", "QUARANTINE", "GROWOUT", "OTHER"];
const statuses = ["ACTIVE", "PLANNING", "ARCHIVED"];

export function AquariumForm({ aquarium }: AquariumFormProps) {
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
        <Input name="volumeGallons" type="number" step="0.1" defaultValue={aquarium?.volumeGallons ?? ""} />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">Location</span>
        <Input name="location" defaultValue={aquarium?.location ?? ""} />
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
      <label className="space-y-1 md:col-span-2">
        <span className="text-sm font-medium">Notes</span>
        <Textarea name="notes" defaultValue={aquarium?.notes ?? ""} />
      </label>
      <div className="md:col-span-2">
        <Button type="submit">{aquarium ? "Save aquarium" : "Create aquarium"}</Button>
      </div>
    </form>
  );
}
