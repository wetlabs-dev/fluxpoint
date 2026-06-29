import { getHusbandrySectionsForSpeciesType, normalizeHusbandryFields, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { HusbandryMagicFillButton } from "@/components/husbandry/HusbandryMagicFillButton";

const speciesTypes = ["FRESHWATER_FISH", "MARINE_FISH", "PLANT", "INVERTEBRATE", "CORAL", "OTHER"];

export function SpeciesHusbandryGuideForm({
  action,
  speciesDefinitionId,
  speciesType,
  guide,
  includeMagicFill = true
}: {
  action: (formData: FormData) => Promise<void>;
  speciesDefinitionId: string;
  speciesType: HusbandrySpeciesType;
  guide?: { summary: string | null; careDifficulty: string | null; sourceNotes: string | null; status: string; fields: unknown } | null;
  includeMagicFill?: boolean;
}) {
  const values = normalizeHusbandryFields(speciesType, guide?.fields);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="speciesDefinitionId" value={speciesDefinitionId} />
      <input type="hidden" name="husbandryMagicFillRequestLogId" value="" />
      <div className="grid gap-3 md:grid-cols-3">
        <Select name="speciesType" defaultValue={speciesType}>{speciesTypes.map((type) => <option key={type}>{type}</option>)}</Select>
        <Select name="status" defaultValue={guide?.status === "REVIEWED" ? "REVIEWED" : guide?.status === "AI_DRAFT" ? "AI_DRAFT" : "LOCAL"}>
          <option value="LOCAL">Local</option>
          <option value="AI_DRAFT">AI draft</option>
          <option value="REVIEWED">Reviewed</option>
        </Select>
        <Input name="careDifficulty" placeholder="Care difficulty" defaultValue={guide?.careDifficulty ?? ""} />
      </div>
      <Textarea name="summary" placeholder="Summary" defaultValue={guide?.summary ?? ""} />
      <Textarea name="sourceNotes" placeholder="Source / review notes" defaultValue={guide?.sourceNotes ?? ""} />
      {includeMagicFill ? <HusbandryMagicFillButton speciesDefinitionId={speciesDefinitionId} speciesType={speciesType} /> : null}
      <div className="grid gap-4">
        {getHusbandrySectionsForSpeciesType(speciesType).map((section) => (
          <section key={section.key} className="rounded-md border border-border bg-background/55 p-4">
            <h4 className="font-semibold text-primary">{section.title}</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {section.fields.map((field) => (
                <label key={field.key} className="grid gap-1 text-sm font-medium">
                  <span>{field.label}</span>
                  <Textarea className={field.multiline ? "min-h-28" : "min-h-16"} name={field.key} defaultValue={values[field.key] ?? ""} placeholder={field.help ?? ""} />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Button type="submit">Save husbandry guide</Button>
    </form>
  );
}
