import { PencilLine } from "lucide-react";
import { getHusbandrySectionsForSpeciesType, husbandryDifferences, normalizeHusbandryFields, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { HusbandryBadges } from "@/components/husbandry/HusbandryBadges";

export function SpeciesHusbandryGuideView({
  speciesType,
  fields,
  baseFields,
  overrideFields,
  editAction,
  editTargetId,
  editTargetName,
  title = "Husbandry guide",
  sourceLabel,
  showEmptyFields = false
}: {
  speciesType: HusbandrySpeciesType;
  fields: unknown;
  baseFields?: unknown;
  overrideFields?: unknown;
  editAction?: (formData: FormData) => Promise<void>;
  editTargetId?: string;
  editTargetName: "speciesDefinitionId" | "aquariumItemId";
  title?: string;
  sourceLabel?: string | null;
  showEmptyFields?: boolean;
}) {
  const values = normalizeHusbandryFields(speciesType, fields);
  const differences = husbandryDifferences(speciesType, baseFields, overrideFields ?? fields);
  const sections = getHusbandrySectionsForSpeciesType(speciesType);
  const hasAny = Object.values(values).some(Boolean);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        {sourceLabel ? <p className="text-sm text-muted-foreground">{sourceLabel}</p> : null}
        <HusbandryBadges type={speciesType} fields={fields} />
        {!hasAny ? <p className="text-sm text-muted-foreground">No husbandry fields are filled yet.</p> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => {
          const rows = showEmptyFields ? section.fields : section.fields.filter((field) => values[field.key]);
          if (!rows.length) return null;
          return (
            <section key={section.key} className="rounded-md border border-border bg-background/55 p-4">
              <h4 className="font-semibold text-primary">{section.title}</h4>
              <dl className="mt-3 grid gap-3 text-sm">
                {rows.map((field) => (
                  <div key={field.key} className="grid gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
                    <dt className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>{field.label}</span>
                      {differences.has(field.key) ? <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.12em] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">Local adjustment</span> : null}
                      {editAction && editTargetId ? <HusbandryFieldInlineEditor action={editAction} targetName={editTargetName} targetId={editTargetId} fieldName={field.key} label={field.label} defaultValue={values[field.key]} /> : null}
                    </dt>
                    <dd className="whitespace-pre-wrap text-muted-foreground">{values[field.key] || "-"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function HusbandryFieldInlineEditor({ action, targetName, targetId, fieldName, label, defaultValue }: { action: (formData: FormData) => Promise<void>; targetName: "speciesDefinitionId" | "aquariumItemId"; targetId: string; fieldName: string; label: string; defaultValue?: string | null }) {
  return (
    <details className="relative inline-block">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-border bg-muted/45 px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
        <PencilLine className="h-3 w-3" />
        Edit
      </summary>
      <form action={action} className="absolute left-0 z-40 mt-2 grid w-[min(22rem,calc(100vw-2rem))] gap-2 rounded-md border border-border bg-card p-3 shadow-soft">
        <input type="hidden" name="fieldName" value={fieldName} />
        <input type="hidden" name={targetName} value={targetId} />
        <label className="grid gap-1 text-sm font-medium">
          {label}
          <Textarea name="fieldValue" defaultValue={defaultValue ?? ""} />
        </label>
        <p className="text-xs text-muted-foreground">Leave blank and save to clear this field.</p>
        <Button className="w-fit" type="submit" variant="secondary">Save field</Button>
      </form>
    </details>
  );
}
