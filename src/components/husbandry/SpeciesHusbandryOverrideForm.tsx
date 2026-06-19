import { getHusbandrySectionsForSpeciesType, normalizeHusbandryFields, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function SpeciesHusbandryOverrideForm({
  action,
  aquariumItemId,
  speciesType,
  override
}: {
  action: (formData: FormData) => Promise<void>;
  aquariumItemId: string;
  speciesType: HusbandrySpeciesType;
  override?: { overrideNotes: string | null; fields: unknown } | null;
}) {
  const values = normalizeHusbandryFields(speciesType, override?.fields);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="aquariumItemId" value={aquariumItemId} />
      <input type="hidden" name="speciesType" value={speciesType} />
      <div className="rounded-md bg-muted/45 p-3 text-sm text-muted-foreground">
        Fill only fields that are different for this item or group. Blank fields inherit from the species guide.
      </div>
      {getHusbandrySectionsForSpeciesType(speciesType).map((section) => (
        <section key={section.key} className="rounded-md border border-border bg-background/55 p-4">
          <h4 className="font-semibold text-primary">{section.title}</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {section.fields.map((field) => (
              <label key={field.key} className="grid gap-1 text-sm font-medium">
                <span>{field.label}</span>
                <Textarea className={field.multiline ? "min-h-28" : "min-h-16"} name={field.key} defaultValue={values[field.key] ?? ""} />
              </label>
            ))}
          </div>
        </section>
      ))}
      <Textarea name="overrideNotes" placeholder="Override notes" defaultValue={override?.overrideNotes ?? ""} />
      <Button type="submit">Save local husbandry adjustments</Button>
    </form>
  );
}
