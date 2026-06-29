"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { speciesAliasTypeLabels, speciesAliasTypes, type SpeciesAliasDraft } from "@/domains/species/aliases";
import type { SpeciesMagicFillDraft } from "@/domains/species/species-magic-fill";
import { regionalSpeciesStatuses, regionalStatusConfidences, regionalStatusLabels } from "@/domains/species/regional-status";
import { habitatsForSalinity } from "@/domains/species/habitat";
import { EddyIcon } from "@/components/eddy/EddyIcon";

const categories = ["FISH", "INVERT", "PLANT", "CORAL", "OTHER"] as const;
type Category = typeof categories[number];

type SpeciesValue = Record<string, any> & { aliases?: SpeciesAliasDraft[] };
type RegionalDraft = SpeciesMagicFillDraft["regionalStatus"];

export function SpeciesForm({ action, species, fixedCategory, collectionLocality }: { action: (formData: FormData) => Promise<void>; species?: SpeciesValue; fixedCategory?: string; collectionLocality?: { label: string | null; ready: boolean } }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<Category>((fixedCategory ?? species?.category ?? "FISH") as Category);
  const [aliases, setAliases] = useState<SpeciesAliasDraft[]>((species?.aliases ?? []).map((row) => ({ alias: row.alias, aliasType: row.aliasType, notes: row.notes ?? null, source: row.source ?? null })));
  const [requestLogId, setRequestLogId] = useState("");
  const [salinityMin, setSalinityMin] = useState(species?.salinityMin == null ? "" : String(species.salinityMin));
  const [salinityMax, setSalinityMax] = useState(species?.salinityMax == null ? "" : String(species.salinityMax));
  const [status, setStatus] = useState("");
  const salinityHabitats = habitatsForSalinity(salinityMin === "" ? null : Number(salinityMin), salinityMax === "" ? null : Number(salinityMax));
  const existingRegional = species?.regionalStatuses?.[0];
  const [regional, setRegional] = useState<RegionalDraft>({ status: existingRegional?.status ?? "UNKNOWN", localityLabel: existingRegional?.localityLabelSnapshot ?? collectionLocality?.label ?? null, statusScope: existingRegional?.statusScope ?? null, sourceName: existingRegional?.sourceName ?? null, sourceUrl: existingRegional?.sourceUrl ?? null, notes: existingRegional?.notes ?? null, confidence: existingRegional?.confidence ?? null });

  useEffect(() => {
    if (fixedCategory && categories.includes(fixedCategory as Category)) setCategory(fixedCategory as Category);
  }, [fixedCategory]);

  function applyDraft(draft: SpeciesMagicFillDraft, logId: string) {
    const categoryChanged = draft.canonical.category !== category;
    setCategory(draft.canonical.category);
    setAliases((current) => {
      const seen = new Set<string>();
      return [...current, ...draft.aliases.map((row) => ({ ...row, source: row.source ?? "Eddy Magic Fill" }))].filter((row) => {
        const key = row.alias.trim().replace(/\s+/g, " ").toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
    setRequestLogId(logId);
    setRegional(draft.regionalStatus);
    setSalinityMin(draft.salinityMinPpt == null ? "" : String(draft.salinityMinPpt));
    setSalinityMax(draft.salinityMaxPpt == null ? "" : String(draft.salinityMaxPpt));
    setStatus(categoryChanged ? `Draft applied, including category change to ${categoryLabel(draft.canonical.category)}. Review and save to keep changes.` : "Draft applied. Review and save to keep changes.");
    window.setTimeout(() => {
      if (!formRef.current) return;
      const values: Record<string, unknown> = { ...draft.profile, ...draft.references, commonName: draft.canonical.commonName, genus: draft.canonical.genus, species: draft.canonical.species, variety: draft.canonical.variety, cultivar: draft.canonical.cultivar };
      for (const [name, value] of Object.entries(values)) {
        const control = formRef.current.elements.namedItem(name);
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) control.value = value == null ? "" : String(value);
      }
    }, 0);
  }

  return (
    <form ref={formRef} action={action} data-testid={species ? `species-edit-form-${species.id}` : "species-create-form"} className="mt-4 space-y-5">
      {species ? <input type="hidden" name="id" value={species.id} /> : null}
      <input type="hidden" name="magicFillRequestLogId" value={requestLogId} />
      <FormSection title="Identity" description="Canonical taxonomy and the keeper-facing name.">
        {fixedCategory ? (
          <Field label="Category"><input type="hidden" name="category" value={category} /><div className="rounded-md bg-muted/55 px-3 py-2 text-sm font-semibold text-primary">{categoryLabel(category)}</div></Field>
        ) : (
          <Field label="Category"><Select name="category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}</Select></Field>
        )}
        <Field label="Common name"><Input name="commonName" placeholder="Example: Zebra obliquidens" defaultValue={species?.commonName ?? ""} required /></Field>
        <Field label="Genus"><Input name="genus" placeholder="Example: Astatotilapia" defaultValue={species?.genus ?? ""} /></Field>
        <Field label="Species"><Input name="species" placeholder="Example: latifasciata" defaultValue={species?.species ?? ""} /></Field>
        <Field label="Variety"><Input name="variety" placeholder="Optional variety" defaultValue={species?.variety ?? ""} /></Field>
        <Field label="Cultivar"><Input name="cultivar" placeholder="Optional cultivar" defaultValue={species?.cultivar ?? ""} /></Field>
        <Field label="Author citation" className="sm:col-span-2 lg:col-span-3"><Input name="authorCitation" placeholder="Example: (Regan, 1929)" defaultValue={species?.authorCitation ?? ""} /></Field>
        <div className="rounded-md bg-muted/45 p-3 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">Scientific display name is derived automatically from genus, species, variety, and cultivar. Author citation is stored separately.</div>
      </FormSection>
      <SpeciesMagicFill formRef={formRef} category={category} speciesDefinitionId={species?.id} onApply={applyDraft} />
      {status ? <p role="status" className="rounded-md border border-emerald-500/35 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">{status}</p> : null}
      <FormSection title="Reference links" description="Optional direct taxon references. HTTPS links are preferred. POWO is plant-only in Fluxpoint.">
        <Field label="Wikipedia URL"><Input name="wikipediaUrl" type="url" inputMode="url" placeholder="https://…" defaultValue={species?.wikipediaUrl ?? ""} /></Field>
        <Field label="iNaturalist URL"><Input name="inaturalistUrl" type="url" inputMode="url" placeholder="https://…" defaultValue={species?.inaturalistUrl ?? ""} /></Field>
        {category === "PLANT" ? <Field label="POWO URL"><Input name="powoUrl" type="url" inputMode="url" placeholder="https://powo.science.kew.org/…" defaultValue={species?.powoUrl ?? ""} /></Field> : <input type="hidden" name="powoUrl" value={species?.powoUrl ?? ""} />}
        <Field label="GBIF URL"><Input name="gbifUrl" type="url" inputMode="url" placeholder="https://www.gbif.org/species/…" defaultValue={species?.gbifUrl ?? ""} /></Field>
      </FormSection>
      <FormSection title="Care range" description="Record only ranges you can support for this definition.">
        {typeSpecificFields(category, species)}
        <Field label="Salinity minimum (ppt)"><Input name="salinityMin" type="number" min="0" step="0.1" value={salinityMin} onChange={(event) => setSalinityMin(event.target.value)} /></Field>
        <Field label="Salinity maximum (ppt)"><Input name="salinityMax" type="number" min="0" step="0.1" value={salinityMax} onChange={(event) => setSalinityMax(event.target.value)} /></Field>
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/45 p-3 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3"><span>Derived habitat:</span>{salinityHabitats.length ? salinityHabitats.map((habitat) => <Badge key={habitat}>✓ {habitat}</Badge>) : <span>enter a salinity range</span>}</div>
      </FormSection>
      <RegionalStatusFields value={regional} onChange={setRegional} locality={collectionLocality} />
      <SpeciesAliasFields rows={aliases} onChange={setAliases} />
      <input type="hidden" name="careNotes" value={species?.careNotes ?? ""} />
      <FormSection title="Notes"><Field label="Notes" className="sm:col-span-2 lg:col-span-3"><Textarea name="notes" placeholder="General taxonomy, sourcing, or care context" defaultValue={species?.notes ?? ""} /></Field></FormSection>
      <Button className="w-full sm:w-auto" type="submit">{species ? "Save species" : "Create species"}</Button>
    </form>
  );
}

function SpeciesMagicFill({ formRef, category, speciesDefinitionId, onApply }: { formRef: React.RefObject<HTMLFormElement | null>; category: Category; speciesDefinitionId?: string; onApply: (draft: SpeciesMagicFillDraft, requestLogId: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ draft: SpeciesMagicFillDraft; requestLogId: string; usage?: { dailyUser?: { remaining?: number } } } | null>(null);

  async function generate() {
    if (!formRef.current) return;
    setLoading(true); setError(""); setResult(null);
    const form = new FormData(formRef.current);
    const number = (name: string) => { const value = String(form.get(name) ?? "").trim(); return value ? Number(value) : null; };
    const input = {
      category, commonName: String(form.get("commonName") || ""), genus: String(form.get("genus") || ""), species: String(form.get("species") || ""), variety: String(form.get("variety") || ""), cultivar: String(form.get("cultivar") || ""), authorCitation: String(form.get("authorCitation") || ""), wikipediaUrl: String(form.get("wikipediaUrl") || ""), inaturalistUrl: String(form.get("inaturalistUrl") || ""), powoUrl: String(form.get("powoUrl") || ""), gbifUrl: String(form.get("gbifUrl") || ""),
      lifespan: String(form.get("lifespan") || ""), minimumGroupSize: number("minimumGroupSize"), maxSize: String(form.get("maxSize") || ""), maxHeight: number("maxHeight"), maxSpread: number("maxSpread"), growthRate: String(form.get("growthRate") || ""), lightRequirement: String(form.get("lightRequirement") || ""), co2Preference: String(form.get("co2Preference") || ""), preferredHardness: String(form.get("preferredHardness") || ""), breedingNotes: String(form.get("breedingNotes") || ""), flowRequirement: String(form.get("flowRequirement") || ""),
      tempMin: number("tempMin"), tempMax: number("tempMax"), phMin: number("phMin"), phMax: number("phMax"), ghMin: number("ghMin"), ghMax: number("ghMax"), khMin: number("khMin"), khMax: number("khMax"), salinityMinPpt: number("salinityMin"), salinityMaxPpt: number("salinityMax"), notes: String(form.get("notes") || ""),
      existingAliases: form.getAll("aliasName").map((alias, index) => ({ alias: String(alias), aliasType: String(form.getAll("aliasType")[index] || "OTHER") }))
    };
    try {
      const response = await fetch("/api/eddy/species-magic-fill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ speciesDefinitionId, input }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Eddy could not prepare a species draft.");
      setResult(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Eddy could not prepare a species draft."); }
    finally { setLoading(false); }
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-primary/35 bg-primary/5 p-4 md:col-span-2" aria-label="Eddy Species Magic Fill">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3"><span className="rounded-md bg-white/85 p-1 dark:bg-white/90"><EddyIcon size={32} alt="Eddy" /></span><div className="min-w-0"><p className="font-semibold text-primary">Eddy Species Magic Fill</p><p className="text-sm text-muted-foreground">Draft the full species profile — taxonomy, care ranges, references, and aliases — for review.</p></div></div>
        <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={generate} disabled={loading}>{loading ? "Eddy is checking this species…" : "Ask Eddy to Magic Fill"}</Button>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div className="mt-4 min-w-0 space-y-4 overflow-hidden rounded-md border border-border bg-background/80 p-4">
          <div className="flex flex-wrap items-center gap-2"><Badge>{result.draft.confidence} confidence</Badge><span className="text-xs text-muted-foreground">{result.usage?.dailyUser?.remaining ?? "—"} personal draft(s) remaining today</span></div>
          <p className="text-sm">{result.draft.summary}</p>
          {result.draft.warnings.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-300">{result.draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <ReviewGroup title="Identity" rows={Object.entries(result.draft.canonical).filter(([, value]) => value != null).map(([key, value]) => [humanize(key), String(value)])} />
            <ReviewGroup title="Profile" rows={Object.entries(result.draft.profile).filter(([, value]) => value != null).map(([key, value]) => [humanize(key), String(value)])} />
            <ReviewGroup title="References" rows={Object.entries(result.draft.references).filter(([, value]) => value != null).map(([key, value]) => [humanize(key), String(value)])} />
            <ReviewGroup title="Target salinity" rows={[["Minimum", result.draft.salinityMinPpt == null ? "Unknown" : `${result.draft.salinityMinPpt} ppt`], ["Maximum", result.draft.salinityMaxPpt == null ? "Unknown" : `${result.draft.salinityMaxPpt} ppt`]]} />
          </div>
          <div className={`rounded-md border p-3 text-xs ${["INVASIVE", "RESTRICTED", "PROHIBITED"].includes(result.draft.regionalStatus.status) ? "border-destructive/50 bg-destructive/10" : "border-border bg-muted/40"}`}>
            <p className="font-semibold">Regional status · {regionalStatusLabels[result.draft.regionalStatus.status]}</p>
            <p className="mt-1 text-muted-foreground">{result.draft.regionalStatus.localityLabel ?? "No collection locality configured"}{result.draft.regionalStatus.confidence ? ` · ${result.draft.regionalStatus.confidence} confidence` : ""}</p>
            <p className="mt-2">{result.draft.regionalStatus.notes ?? "No reliable regional status available."}</p>
            {result.draft.regionalStatus.sourceName ? <p className="mt-1 text-muted-foreground">Source draft: {result.draft.regionalStatus.sourceName}</p> : null}
          </div>
          {result.draft.aliases.length ? <div className="rounded-md bg-muted/40 p-3 text-xs"><p className="font-semibold">Aliases</p><ul className="mt-1 space-y-1">{result.draft.aliases.map((row) => <li key={`${row.aliasType}:${row.alias}`}><span className="font-medium">{row.alias}</span> · {speciesAliasTypeLabels[row.aliasType]}{row.source ? ` · ${row.source}` : ""}{row.notes ? ` — ${row.notes}` : ""}</li>)}</ul></div> : null}
          <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => { onApply(result.draft, result.requestLogId); setResult(null); }}>Apply draft to form</Button><Button type="button" variant="secondary" onClick={() => setResult(null)}>Discard</Button></div>
          <p className="text-xs text-muted-foreground">Applying changes the form only. Nothing is saved until you submit the species form.</p>
        </div>
      ) : null}
    </section>
  );
}

function RegionalStatusFields({ value, onChange, locality }: { value: RegionalDraft; onChange: (value: RegionalDraft) => void; locality?: { label: string | null; ready: boolean } }) {
  const set = (patch: Partial<RegionalDraft>) => onChange({ ...value, ...patch });
  return <fieldset className="space-y-3 rounded-lg border border-border bg-background/45 p-4">
    <div><legend className="font-semibold">Regional status</legend><p className="text-xs text-muted-foreground">Applies to {value.localityLabel ?? locality?.label ?? "the collection locality"}; this is regional context, not a universal species trait or legal advice.</p></div>
    {!locality?.ready ? <p className="rounded-md bg-muted/55 p-2 text-sm text-muted-foreground">Add collection locality to check regional invasive/restricted status.</p> : null}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1"><span className="text-sm font-medium">Status</span><Select name="regionalStatus" value={value.status} onChange={(event) => set({ status: event.target.value as RegionalDraft["status"] })}>{regionalSpeciesStatuses.map((status) => <option key={status} value={status}>{regionalStatusLabels[status]}</option>)}</Select></label>
      <label className="grid gap-1"><span className="text-sm font-medium">Confidence</span><Select name="regionalConfidence" value={value.confidence ?? ""} onChange={(event) => set({ confidence: (event.target.value || null) as RegionalDraft["confidence"] })}><option value="">Not set</option>{regionalStatusConfidences.map((confidence) => <option key={confidence}>{confidence}</option>)}</Select></label>
      <Field label="Scope"><Input name="regionalStatusScope" placeholder="Country, province, locality…" value={value.statusScope ?? ""} onChange={(event) => set({ statusScope: event.target.value || null })} /></Field>
      <Field label="Source / authority"><Input name="regionalSourceName" placeholder="Authority name" value={value.sourceName ?? ""} onChange={(event) => set({ sourceName: event.target.value || null })} /></Field>
      <Field label="Source URL" className="sm:col-span-2"><Input name="regionalSourceUrl" type="url" inputMode="url" placeholder="https://…" value={value.sourceUrl ?? ""} onChange={(event) => set({ sourceUrl: event.target.value || null })} /></Field>
      <Field label="Regional context and handling action" className="sm:col-span-2"><Textarea name="regionalNotes" placeholder="Regional context and handling caution" value={value.notes ?? ""} onChange={(event) => set({ notes: event.target.value || null })} /></Field>
    </div>
  </fieldset>;
}

function ReviewGroup({ title, rows }: { title: string; rows: string[][] }) {
  return <div className="min-w-0 rounded-md bg-muted/50 p-3"><p className="mb-1 font-semibold">{title}</p>{rows.length ? rows.map(([label, value]) => <div key={label} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3"><span className="break-words text-muted-foreground">{label}</span><span className="break-words text-right">{value}</span></div>) : <span className="text-muted-foreground">No proposed values</span>}</div>;
}

function SpeciesAliasFields({ rows, onChange }: { rows: SpeciesAliasDraft[]; onChange: (rows: SpeciesAliasDraft[]) => void }) {
  const update = (index: number, patch: Partial<SpeciesAliasDraft>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return (
    <fieldset className="space-y-3 rounded-lg border border-border bg-background/45 p-4">
      <div className="flex items-center justify-between gap-3"><div><legend className="font-semibold">Aliases</legend><p className="text-xs text-muted-foreground">Alternate names are searchable and remain attached to this species.</p></div><Button type="button" variant="secondary" onClick={() => onChange([...rows, { alias: "", aliasType: "COMMON_NAME", notes: null, source: null }])}>Add alias</Button></div>
      {rows.length ? rows.map((row, index) => (
        <div key={index} className="grid min-w-0 gap-3 rounded-md bg-muted/35 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={`Alias ${index + 1} name`} className="sm:col-span-2"><Input className="min-w-0" name="aliasName" value={row.alias} onChange={(event) => update(index, { alias: event.target.value })} placeholder="Alternate name" /></Field>
          <Field label="Type"><Select name="aliasType" value={row.aliasType} onChange={(event) => update(index, { aliasType: event.target.value as SpeciesAliasDraft["aliasType"] })}>{speciesAliasTypes.map((type) => <option key={type} value={type}>{speciesAliasTypeLabels[type]}</option>)}</Select></Field>
          <div className="flex items-end"><Button className="w-full" type="button" variant="secondary" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button></div>
          <Field label="Notes" className="sm:col-span-2"><Input name="aliasNotes" value={row.notes ?? ""} onChange={(event) => update(index, { notes: event.target.value || null })} placeholder="Optional alias context" /></Field>
          <Field label="Source" className="sm:col-span-2"><Input name="aliasSource" value={row.source ?? ""} onChange={(event) => update(index, { source: event.target.value || null })} placeholder="Optional source" /></Field>
        </div>
      )) : <p className="text-sm text-muted-foreground">No aliases yet.</p>}
    </fieldset>
  );
}

function categoryLabel(category: string) { return category === "INVERT" ? "Invertebrate" : category.charAt(0) + category.slice(1).toLowerCase(); }
function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <fieldset className="rounded-lg border border-border bg-background/45 p-4"><legend className="px-1 font-semibold text-primary">{title}</legend>{description ? <p className="mb-4 text-xs text-muted-foreground">{description}</p> : null}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div></fieldset>;
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`grid min-w-0 content-start gap-1 ${className}`}><span className="text-sm font-medium text-foreground">{label}</span>{children}</label>;
}

function RangeFields({ species }: { species?: SpeciesValue }) { return <>
  <Field label="Temperature minimum"><Input name="tempMin" type="number" step="0.1" placeholder="°F" defaultValue={species?.tempMin ?? ""} /></Field>
  <Field label="Temperature maximum"><Input name="tempMax" type="number" step="0.1" placeholder="°F" defaultValue={species?.tempMax ?? ""} /></Field>
  <Field label="pH minimum"><Input name="phMin" type="number" step="0.1" defaultValue={species?.phMin ?? ""} /></Field>
  <Field label="pH maximum"><Input name="phMax" type="number" step="0.1" defaultValue={species?.phMax ?? ""} /></Field>
  <Field label="GH minimum"><Input name="ghMin" type="number" step="0.1" defaultValue={species?.ghMin ?? ""} /></Field>
  <Field label="GH maximum"><Input name="ghMax" type="number" step="0.1" defaultValue={species?.ghMax ?? ""} /></Field>
  <Field label="KH minimum"><Input name="khMin" type="number" step="0.1" defaultValue={species?.khMin ?? ""} /></Field>
  <Field label="KH maximum"><Input name="khMax" type="number" step="0.1" defaultValue={species?.khMax ?? ""} /></Field>
</>; }
function typeSpecificFields(category: string, species?: SpeciesValue) {
  const ranges = <RangeFields species={species} />;
  if (category === "FISH") return <><Field label="Lifespan"><Input name="lifespan" placeholder="Example: 5–8 years" defaultValue={species?.lifespan ?? ""} /></Field><Field label="Minimum group size"><Input name="minimumGroupSize" type="number" min="0" defaultValue={species?.minimumGroupSize ?? ""} /></Field><Field label="Maximum size"><Input name="maxSize" placeholder="Example: 4–5 in" defaultValue={species?.maxSize ?? ""} /></Field>{ranges}<Field label="Preferred hardness"><Input name="preferredHardness" placeholder="Example: hard, alkaline" defaultValue={species?.preferredHardness ?? ""} /></Field><Field label="Flow requirement"><Input name="flowRequirement" defaultValue={species?.flowRequirement ?? ""} /></Field><Field label="Breeding notes" className="sm:col-span-2 lg:col-span-3"><Textarea name="breedingNotes" defaultValue={species?.breedingNotes ?? ""} /></Field></>;
  if (category === "PLANT") return <><Field label="Maximum height"><Input name="maxHeight" type="number" step="0.1" defaultValue={species?.maxHeight ?? ""} /></Field><Field label="Maximum spread"><Input name="maxSpread" type="number" step="0.1" defaultValue={species?.maxSpread ?? ""} /></Field><Field label="Growth rate"><Input name="growthRate" defaultValue={species?.growthRate ?? ""} /></Field><Field label="Light requirement"><Input name="lightRequirement" defaultValue={species?.lightRequirement ?? ""} /></Field><Field label="CO₂ preference"><Input name="co2Preference" defaultValue={species?.co2Preference ?? ""} /></Field>{ranges}</>;
  if (category === "INVERT") return <><Field label="Lifespan"><Input name="lifespan" defaultValue={species?.lifespan ?? ""} /></Field><Field label="Preferred hardness"><Input name="preferredHardness" defaultValue={species?.preferredHardness ?? ""} /></Field>{ranges}<Field label="Breeding notes" className="sm:col-span-2 lg:col-span-3"><Textarea name="breedingNotes" defaultValue={species?.breedingNotes ?? ""} /></Field></>;
  if (category === "CORAL") return <><Field label="Light requirement"><Input name="lightRequirement" defaultValue={species?.lightRequirement ?? ""} /></Field><Field label="Flow requirement"><Input name="flowRequirement" defaultValue={species?.flowRequirement ?? ""} /></Field>{ranges}</>;
  return ranges;
}
