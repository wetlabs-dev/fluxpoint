import { createAquariumEvent } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

const eventTypes = ["NOTE", "FEEDING", "WATER_CHANGE", "TEST_RESULT", "MAINTENANCE", "MEDICATION", "LIVESTOCK_ADDITION", "LIVESTOCK_LOSS", "PLANT_ADDITION", "PLANT_REMOVAL", "EQUIPMENT_MAINTENANCE", "STOCKING", "DEATH", "SPAWN", "PHOTO", "EQUIPMENT_CHANGE", "TRANSFER", "OTHER"];
const parameters = ["", "TEMPERATURE", "PH", "AMMONIA", "NITRITE", "NITRATE", "GH", "KH", "TDS", "TURBIDITY", "CO2", "LIGHT", "WATER_LEVEL", "OTHER"];

export function EventCreateForm({
  aquariumId,
  items = [],
  defaultType = "NOTE",
  compact = false
}: {
  aquariumId: string;
  items?: { id: string; name: string; itemType: string }[];
  defaultType?: string;
  compact?: boolean;
}) {
  return (
    <form action={createAquariumEvent} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <Select name="eventType" defaultValue={defaultType}>
        {eventTypes.map((type) => <option key={type}>{type}</option>)}
      </Select>
      <Select name="relatedItemId" defaultValue="">
        <option value="">No related item</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.itemType.toLowerCase()}</option>)}
      </Select>
      <Input name="title" placeholder="Title" required />
      <Input name="eventDate" type="datetime-local" />
      <Input className="md:col-span-2" name="summary" placeholder="Summary" />
      {!compact ? (
        <>
          <Select name="parameter" defaultValue="">
            <option value="">Optional test parameter</option>
            {parameters.filter(Boolean).map((parameter) => <option key={parameter}>{parameter}</option>)}
          </Select>
          <Input name="value" type="number" step="0.01" placeholder="Test value" />
          <Input name="unit" placeholder="Test unit" />
        </>
      ) : null}
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes" />
      <Button className="md:col-span-2" type="submit">Add timeline event</Button>
    </form>
  );
}
