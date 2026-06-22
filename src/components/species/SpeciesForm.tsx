"use client";

import { useRef, useState } from "react";
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
  const salinityHabitats = habitatsForSalinity(salinityMin === "" ? null : Number(salinityMin), salinityMax === "" ? null : Number(salinityMax));
  const existingRegional = species?.regionalStatuses?.[0];
  const [regional, setRegional] = useState<RegionalDraft>({ status: existingRegional?.status ?? "UNKNOWN", localityLabel: existingRegional?.localityLabelSnapshot ?? collectionLocality?.label ?? null, statusScope: existingRegional?.statusScope ?? null, sourceName: existingRegional?.sourceName ?? null, sourceUrl: existingRegional?.sourceUrl ?? null, notes: existingRegional?.notes ?? null, confidence: existingRegional?.confidence ?? null });

  function applyDraft(draft: SpeciesMagicFillDraft, logId: string) {
    setCategory(draft.canonical.category);
    setAliases((current) => {
      const seen = new Set<string>();
      return [...current, ...draft.aliases.map((row) => ({ ...row, source: "Eddy Magic Fill" }))].filter((row) => {
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
    window.setTimeout(() => {
      if (!formRef.current) return;
      const values: Record<string, unknown> = { ...draft.profile, commonName: draft.canonical.commonName, genus: draft.canonical.genus, species: draft.canonical.species, variety: draft.canonical.variety, cultivar: draft.canonical.cultivar };
      for (const [name, value] of Object.entries(values)) {
        const control = formRef.current.elements.namedItem(name);
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) control.value = value == null ? "" : String(value);
      }
    }, 0);
  }

  return (
    <form ref={formRef} action={action} data-testid={species ? `species-edit-form-${species.id}` : "species-create-form"} className="mt-4 grid gap-3 md:grid-cols-2">
      {species ? <input type="hidden" name="id" value={species.id} /> : null}
      <input type="hidden" name="magicFillRequestLogId" value={requestLogId} />
      {fixedCategory ? (
        <><input type="hidden" name="category" value={category} /><div className="rounded-md bg-muted/55 px-3 py-2 text-sm font-semibold text-primary">{categoryLabel(category)}</div></>
      ) : (
        <Select name="category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option key={item}>{item}</option>)}</Select>
      )}
      <Input name="commonName" placeholder="Common name" defaultValue={species?.commonName ?? ""} required />
      <Input name="genus" placeholder="Genus" defaultValue={species?.genus ?? ""} />
      <Input name="species" placeholder="Species" defaultValue={species?.species ?? ""} />
      <Input name="variety" placeholder="Variety" defaultValue={species?.variety ?? ""} />
      <Input name="cultivar" placeholder="Cultivar" defaultValue={species?.cultivar ?? ""} />
      <div className="rounded-md bg-muted/45 p-3 text-xs text-muted-foreground md:col-span-2">Scientific display name is derived automatically from genus, species, variety, and cultivar.</div>
      <SpeciesMagicFill formRef={formRef} speciesDefinitionId={species?.id} onApply={applyDraft} />
      {typeSpecificFields(category, species)}
      <label className="grid gap-1"><span className="text-sm font-medium">Salinity minimum (ppt)</span><Input name="salinityMin" type="number" min="0" step="0.1" value={salinityMin} onChange={(event) => setSalinityMin(event.target.value)} /></label>
      <label className="grid gap-1"><span className="text-sm font-medium">Salinity maximum (ppt)</span><Input name="salinityMax" type="number" min="0" step="0.1" value={salinityMax} onChange={(event) => setSalinityMax(event.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/45 p-3 text-xs text-muted-foreground md:col-span-2"><span>Derived habitat:</span>{salinityHabitats.length ? salinityHabitats.map((habitat) => <Badge key={habitat}>✓ {habitat}</Badge>) : <span>enter a salinity range</span>}</div>
      <RegionalStatusFields value={regional} onChange={setRegional} locality={collectionLocality} />
      <SpeciesAliasFields rows={aliases} onChange={setAliases} />
      <input type="hidden" name="careNotes" value={species?.careNotes ?? ""} />
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes" defaultValue={species?.notes ?? ""} />
      <Button className="md:col-span-2" type="submit">{species ? "Save species" : "Create species"}</Button>
    </form>
  );
}

function SpeciesMagicFill({ formRef, speciesDefinitionId, onApply }: { formRef: React.RefObject<HTMLFormElement | null>; speciesDefinitionId?: string; onApply: (draft: SpeciesMagicFillDraft, requestLogId: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ draft: SpeciesMagicFillDraft; requestLogId: string; usage?: { dailyUser?: { remaining?: number } } } | null>(null);

  async function generate() {
    if (!formRef.current) return;
    setLoading(true); setError(""); setResult(null);
    const form = new FormData(formRef.current);
    const number = (name: string) => { const value = String(form.get(name) ?? "").trim(); return value ? Number(value) : null; };
    const input = {
      category: String(form.get("category") || "OTHER"), commonName: String(form.get("commonName") || ""), genus: String(form.get("genus") || ""), species: String(form.get("species") || ""), variety: String(form.get("variety") || ""), cultivar: String(form.get("cultivar") || ""),
      lifespan: String(form.get("lifespan") || ""), minimumGroupSize: number("minimumGroupSize"), maxHeight: number("maxHeight"), maxSpread: number("maxSpread"), growthRate: String(form.get("growthRate") || ""), lightRequirement: String(form.get("lightRequirement") || ""), co2Preference: String(form.get("co2Preference") || ""), preferredHardness: String(form.get("preferredHardness") || ""), breedingNotes: String(form.get("breedingNotes") || ""), flowRequirement: String(form.get("flowRequirement") || ""),
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
    <section className="rounded-lg border border-primary/35 bg-primary/5 p-3 md:col-span-2" aria-label="Eddy Species Magic Fill">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="rounded-md bg-white/85 p-1 dark:bg-white/90"><EddyIcon size={28} alt="Eddy" /></span><div><p className="font-semibold text-primary">Eddy Species Magic Fill</p><p className="text-xs text-muted-foreground">Draft names, care ranges, and aliases for you to review.</p></div></div>
        <Button type="button" variant="secondary" onClick={generate} disabled={loading}>{loading ? "Eddy is checking this species…" : "Ask Eddy to Magic Fill"}</Button>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-background/80 p-3">
          <div className="flex flex-wrap items-center gap-2"><Badge>{result.draft.confidence} confidence</Badge><span className="text-xs text-muted-foreground">{result.usage?.dailyUser?.remaining ?? "—"} personal draft(s) remaining today</span></div>
          <p className="text-sm">{result.draft.summary}</p>
          {result.draft.warnings.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-300">{result.draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <ReviewGroup title="Identity" rows={Object.entries(result.draft.canonical).filter(([, value]) => value != null).map(([key, value]) => [humanize(key), String(value)])} />
            <ReviewGroup title="Profile" rows={Object.entries(result.draft.profile).filter(([, value]) => value != null).map(([key, value]) => [humanize(key), String(value)])} />
            <ReviewGroup title="Target salinity" rows={[["Minimum", result.draft.salinityMinPpt == null ? "Unknown" : `${result.draft.salinityMinPpt} ppt`], ["Maximum", result.draft.salinityMaxPpt == null ? "Unknown" : `${result.draft.salinityMaxPpt} ppt`]]} />
          </div>
          <div className={`rounded-md border p-3 text-xs ${["INVASIVE", "RESTRICTED", "PROHIBITED"].includes(result.draft.regionalStatus.status) ? "border-destructive/50 bg-destructive/10" : "border-border bg-muted/40"}`}>
            <p className="font-semibold">Regional status · {regionalStatusLabels[result.draft.regionalStatus.status]}</p>
            <p className="mt-1 text-muted-foreground">{result.draft.regionalStatus.localityLabel ?? "No collection locality configured"}{result.draft.regionalStatus.confidence ? ` · ${result.draft.regionalStatus.confidence} confidence` : ""}</p>
            <p className="mt-2">{result.draft.regionalStatus.notes ?? "No reliable regional status available."}</p>
            {result.draft.regionalStatus.sourceName ? <p className="mt-1 text-muted-foreground">Source draft: {result.draft.regionalStatus.sourceName}</p> : null}
          </div>
          {result.draft.aliases.length ? <p className="text-xs"><span className="font-semibold">Aliases:</span> {result.draft.aliases.map((row) => row.alias).join(", ")}</p> : null}
          <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => { onApply(result.draft, result.requestLogId); setResult(null); }}>Apply draft to form</Button><Button type="button" variant="secondary" onClick={() => setResult(null)}>Discard</Button></div>
          <p className="text-xs text-muted-foreground">Applying changes the form only. Nothing is saved until you submit the species form.</p>
        </div>
      ) : null}
    </section>
  );
}

function RegionalStatusFields({ value, onChange, locality }: { value: RegionalDraft; onChange: (value: RegionalDraft) => void; locality?: { label: string | null; ready: boolean } }) {
  const set = (patch: Partial<RegionalDraft>) => onChange({ ...value, ...patch });
  return <fieldset className="space-y-3 rounded-md border border-border p-3 md:col-span-2">
    <div><legend className="font-semibold">Regional status</legend><p className="text-xs text-muted-foreground">Applies to {value.localityLabel ?? locality?.label ?? "the collection locality"}; this is regional context, not a universal species trait or legal advice.</p></div>
    {!locality?.ready ? <p className="rounded-md bg-muted/55 p-2 text-sm text-muted-foreground">Add collection locality to check regional invasive/restricted status.</p> : null}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1"><span className="text-sm font-medium">Status</span><Select name="regionalStatus" value={value.status} onChange={(event) => set({ status: event.target.value as RegionalDraft["status"] })}>{regionalSpeciesStatuses.map((status) => <option key={status} value={status}>{regionalStatusLabels[status]}</option>)}</Select></label>
      <label className="grid gap-1"><span className="text-sm font-medium">Confidence</span><Select name="regionalConfidence" value={value.confidence ?? ""} onChange={(event) => set({ confidence: (event.target.value || null) as RegionalDraft["confidence"] })}><option value="">Not set</option>{regionalStatusConfidences.map((confidence) => <option key={confidence}>{confidence}</option>)}</Select></label>
      <Input name="regionalStatusScope" placeholder="Scope: country, province, locality…" value={value.statusScope ?? ""} onChange={(event) => set({ statusScope: event.target.value || null })} />
      <Input name="regionalSourceName" placeholder="Source / authority name" value={value.sourceName ?? ""} onChange={(event) => set({ sourceName: event.target.value || null })} />
      <Input className="sm:col-span-2" name="regionalSourceUrl" type="url" placeholder="Source URL" value={value.sourceUrl ?? ""} onChange={(event) => set({ sourceUrl: event.target.value || null })} />
      <Textarea className="sm:col-span-2" name="regionalNotes" placeholder="Regional context and handling caution" value={value.notes ?? ""} onChange={(event) => set({ notes: event.target.value || null })} />
    </div>
  </fieldset>;
}

function ReviewGroup({ title, rows }: { title: string; rows: string[][] }) {
  return <div className="rounded-md bg-muted/50 p-2"><p className="mb-1 font-semibold">{title}</p>{rows.length ? rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right">{value}</span></div>) : <span className="text-muted-foreground">No proposed values</span>}</div>;
}

function SpeciesAliasFields({ rows, onChange }: { rows: SpeciesAliasDraft[]; onChange: (rows: SpeciesAliasDraft[]) => void }) {
  const update = (index: number, patch: Partial<SpeciesAliasDraft>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return (
    <fieldset className="space-y-3 rounded-md border border-border p-3 md:col-span-2">
      <div className="flex items-center justify-between gap-3"><div><legend className="font-semibold">Aliases</legend><p className="text-xs text-muted-foreground">Alternate names are searchable and remain attached to this species.</p></div><Button type="button" variant="secondary" onClick={() => onChange([...rows, { alias: "", aliasType: "COMMON_NAME", notes: null, source: null }])}>Add alias</Button></div>
      {rows.length ? rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-md bg-muted/35 p-2 sm:grid-cols-[1fr_170px_auto]">
          <Input name="aliasName" aria-label={`Alias ${index + 1}`} value={row.alias} onChange={(event) => update(index, { alias: event.target.value })} placeholder="Alternate name" />
          <Select name="aliasType" aria-label={`Alias type ${index + 1}`} value={row.aliasType} onChange={(event) => update(index, { aliasType: event.target.value as SpeciesAliasDraft["aliasType"] })}>{speciesAliasTypes.map((type) => <option key={type} value={type}>{speciesAliasTypeLabels[type]}</option>)}</Select>
          <Button type="button" variant="secondary" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
          <Input className="sm:col-span-2" name="aliasNotes" aria-label={`Alias notes ${index + 1}`} value={row.notes ?? ""} onChange={(event) => update(index, { notes: event.target.value || null })} placeholder="Notes (optional)" />
          <Input name="aliasSource" aria-label={`Alias source ${index + 1}`} value={row.source ?? ""} onChange={(event) => update(index, { source: event.target.value || null })} placeholder="Source (optional)" />
        </div>
      )) : <p className="text-sm text-muted-foreground">No aliases yet.</p>}
    </fieldset>
  );
}

function categoryLabel(category: string) { return category === "INVERT" ? "Invertebrate" : category.charAt(0) + category.slice(1).toLowerCase(); }
function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }

function RangeFields({ species }: { species?: SpeciesValue }) { return <><Input name="tempMin" type="number" step="0.1" placeholder="Temp min" defaultValue={species?.tempMin ?? ""} /><Input name="tempMax" type="number" step="0.1" placeholder="Temp max" defaultValue={species?.tempMax ?? ""} /><Input name="phMin" type="number" step="0.1" placeholder="pH min" defaultValue={species?.phMin ?? ""} /><Input name="phMax" type="number" step="0.1" placeholder="pH max" defaultValue={species?.phMax ?? ""} /><Input name="ghMin" type="number" step="0.1" placeholder="GH min" defaultValue={species?.ghMin ?? ""} /><Input name="ghMax" type="number" step="0.1" placeholder="GH max" defaultValue={species?.ghMax ?? ""} /><Input name="khMin" type="number" step="0.1" placeholder="KH min" defaultValue={species?.khMin ?? ""} /><Input name="khMax" type="number" step="0.1" placeholder="KH max" defaultValue={species?.khMax ?? ""} /></>; }
function typeSpecificFields(category: string, species?: SpeciesValue) {
  if (category === "FISH") return <><Input name="lifespan" placeholder="Lifespan" defaultValue={species?.lifespan ?? ""} /><Input name="minimumGroupSize" type="number" placeholder="Minimum group size" defaultValue={species?.minimumGroupSize ?? ""} /><RangeFields species={species} /><Input name="preferredHardness" placeholder="Preferred hardness" defaultValue={species?.preferredHardness ?? ""} /><Input name="flowRequirement" placeholder="Flow requirement" defaultValue={species?.flowRequirement ?? ""} /><Textarea className="md:col-span-2" name="breedingNotes" placeholder="Breeding notes" defaultValue={species?.breedingNotes ?? ""} /></>;
  if (category === "PLANT") return <><Input name="maxHeight" type="number" step="0.1" placeholder="Max height" defaultValue={species?.maxHeight ?? ""} /><Input name="maxSpread" type="number" step="0.1" placeholder="Max spread" defaultValue={species?.maxSpread ?? ""} /><Input name="growthRate" placeholder="Growth rate" defaultValue={species?.growthRate ?? ""} /><Input name="lightRequirement" placeholder="Light requirement" defaultValue={species?.lightRequirement ?? ""} /><Input name="co2Preference" placeholder="CO2 preference" defaultValue={species?.co2Preference ?? ""} /><RangeFields species={species} /></>;
  if (category === "INVERT") return <><Input name="lifespan" placeholder="Lifespan" defaultValue={species?.lifespan ?? ""} /><Input name="preferredHardness" placeholder="Preferred hardness" defaultValue={species?.preferredHardness ?? ""} /><RangeFields species={species} /><Textarea className="md:col-span-2" name="breedingNotes" placeholder="Breeding notes" defaultValue={species?.breedingNotes ?? ""} /></>;
  if (category === "CORAL") return <><Input name="lightRequirement" placeholder="Light requirement" defaultValue={species?.lightRequirement ?? ""} /><Input name="flowRequirement" placeholder="Flow requirement" defaultValue={species?.flowRequirement ?? ""} /><RangeFields species={species} /></>;
  return null;
}
