import {
  additionalContentCategories,
  additionalContentCategoryLabels,
  additionalContentConfidenceLabels,
  additionalContentConfidences,
  additionalContentIntentLabels,
  additionalContentIntents,
  additionalContentInventoryType
} from "@/domains/aquariums/additional-contents";
import { archiveAdditionalTankContent, createAdditionalTankContent, deleteAdditionalTankContent, updateAdditionalTankContent } from "@/domains/aquariums/additional-content-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { AquariumAdditionalContent } from "@prisma/client";

type Row = Pick<AquariumAdditionalContent, "id" | "aquariumId" | "category" | "description" | "approximateQuantity" | "confidence" | "intent" | "includeInEddyContext" | "notes" | "createdAt">;

type Props = {
  aquariumId: string;
  rows: Row[];
  canEdit: boolean;
  compact?: boolean;
};

export function AdditionalContentsPanel({ aquariumId, rows, canEdit, compact = false }: Props) {
  const grouped = additionalContentCategories
    .map((category) => [category, rows.filter((row) => row.category === category)] as const)
    .filter(([, entries]) => entries.length);
  const needsStructuredRecords = rows.filter((row) => row.intent === "NEEDS_STRUCTURED_RECORD").length;

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Additional tank contents</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            These entries are for things you want Fluxpoint to remember but haven’t modeled as full inventory yet.
          </p>
        </div>
        {needsStructuredRecords ? <Badge>{needsStructuredRecords} need structured records</Badge> : null}
      </div>

      <div className="mt-4 space-y-4">
        {grouped.length ? grouped.map(([category, entries]) => (
          <div key={category}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{additionalContentCategoryLabels[category]}</h4>
            <div className="grid gap-2">
              {entries.map((row) => <AdditionalContentRow key={row.id} row={row} canEdit={canEdit && !compact} />)}
            </div>
          </div>
        )) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No extra remembered contents yet.</div>}
      </div>

      {compact ? null : canEdit ? (
        <details className="mt-5 rounded-md border border-border bg-background/45 p-3">
          <summary className="cursor-pointer font-semibold text-primary">Add remembered content</summary>
          <form action={createAdditionalTankContent} className="mt-3 grid gap-3">
            <input type="hidden" name="aquariumId" value={aquariumId} />
            <ContentFields />
            <Button type="submit">Remember content</Button>
          </form>
        </details>
      ) : <p className="mt-4 text-sm text-muted-foreground">Aquarist access is required to manage remembered tank contents.</p>}
    </section>
  );
}

function AdditionalContentRow({ row, canEdit }: { row: Row; canEdit: boolean }) {
  const inventoryType = additionalContentInventoryType(row.category);
  return (
    <div className="rounded-md border border-border bg-background/55 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-primary">{row.description}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {row.approximateQuantity ? <span>approx. {row.approximateQuantity}</span> : null}
            <span>{additionalContentConfidenceLabels[row.confidence]}</span>
            <span>{additionalContentIntentLabels[row.intent]}</span>
            <span>{row.includeInEddyContext ? "included in Eddy context" : "not used by Eddy"}</span>
          </div>
          {row.notes ? <p className="mt-2 text-sm text-muted-foreground">{row.notes}</p> : null}
        </div>
        {row.intent === "NEEDS_STRUCTURED_RECORD" ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Convert to {inventoryType.toLowerCase()} planned
          </span>
        ) : null}
      </div>

      {canEdit ? (
        <details className="mt-3 rounded-md border border-border bg-muted/25 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-primary">Edit remembered content</summary>
          <form action={updateAdditionalTankContent} className="mt-3 grid gap-3">
            <input type="hidden" name="id" value={row.id} />
            <ContentFields row={row} />
            <Button type="submit" variant="secondary">Save content</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={archiveAdditionalTankContent}>
              <input type="hidden" name="id" value={row.id} />
              <Button type="submit" variant="ghost">Archive</Button>
            </form>
            <form action={deleteAdditionalTankContent}>
              <input type="hidden" name="id" value={row.id} />
              <Button type="submit" variant="ghost" className="text-destructive hover:bg-destructive/10">Delete</Button>
            </form>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ContentFields({ row }: { row?: Row }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-muted-foreground">
          Category
          <Select name="category" defaultValue={row?.category ?? "UNKNOWN"}>
            {additionalContentCategories.map((category) => <option key={category} value={category}>{additionalContentCategoryLabels[category]}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-muted-foreground md:col-span-2">
          Description
          <Input name="description" required maxLength={240} placeholder="e.g. large driftwood cave, loose frogbit, unknown hitchhiker snail" defaultValue={row?.description ?? ""} />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-muted-foreground">
          Approx. quantity
          <Input name="approximateQuantity" maxLength={80} placeholder="e.g. several, 3–5, one clump" defaultValue={row?.approximateQuantity ?? ""} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-muted-foreground">
          Confidence
          <Select name="confidence" defaultValue={row?.confidence ?? "UNKNOWN"}>
            {additionalContentConfidences.map((confidence) => <option key={confidence} value={confidence}>{additionalContentConfidenceLabels[confidence]}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-muted-foreground">
          Intent
          <Select name="intent" defaultValue={row?.intent ?? "INFORMATIONAL"}>
            {additionalContentIntents.map((intent) => <option key={intent} value={intent}>{additionalContentIntentLabels[intent]}</option>)}
          </Select>
        </label>
      </div>
      <input type="hidden" name="includeInEddyContext" value="off" />
      <label className="flex items-center gap-2 rounded-md bg-muted/35 p-2 text-sm font-semibold text-muted-foreground">
        <input type="checkbox" name="includeInEddyContext" defaultChecked={row?.includeInEddyContext ?? true} />
        Include this in Eddy context
      </label>
      <Textarea name="notes" placeholder="Optional context, caveats, or where you noticed it." defaultValue={row?.notes ?? ""} />
    </>
  );
}
