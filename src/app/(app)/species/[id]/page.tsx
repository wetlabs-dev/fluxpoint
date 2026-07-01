import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { buildScientificNameWithAuthor } from "@/lib/format/species";
import {
  deleteSpeciesHusbandryGuideAction,
  deleteSpeciesRegionalStatus,
  forkSpeciesHusbandryGuideAction,
  linkSpeciesHusbandryGuideAction,
  saveSpeciesHusbandryGuideAction,
  saveSpeciesHusbandryGuideFieldAction,
  saveSpeciesRegionalStatusAction
} from "@/domains/management/actions";
import { getResolvedSpeciesHusbandryGuide } from "@/domains/husbandry/husbandry-service";
import { inferSpeciesHusbandryType, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SpeciesHusbandryGuideView } from "@/components/husbandry/SpeciesHusbandryGuideView";
import { SpeciesHusbandryGuideForm } from "@/components/husbandry/SpeciesHusbandryGuideForm";
import { HusbandryLinkControls } from "@/components/husbandry/HusbandryLinkControls";
import { HusbandryEmptyPrompt } from "@/components/husbandry/HusbandryEmptyPrompt";
import { labelSpeciesBioloadClass } from "@/domains/species/bioload";
import { EddySpeciesAssistant } from "@/components/eddy/EddySpeciesAssistant";
import { RegionalStatusBadge } from "@/components/species/RegionalStatusBadge";
import { buildLocalityLabel, isConcerningRegionalStatus, neverReleaseMessage, regionalSpeciesStatuses, regionalStatusConfidences, regionalStatusLabels } from "@/domains/species/regional-status";
import { addSpeciesTrait, archiveSpeciesVariant, createSpeciesVariant, updateSpeciesVariant } from "@/domains/breeding/actions";

export const dynamic = "force-dynamic";

export default async function SpeciesDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ createVariant?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const definition = await prisma.speciesDefinition.findFirst({
    where: { id, OR: [{ collectionId: collection.id }, { collectionId: null }] },
    include: {
      aliases: { where: { collectionId: collection.id }, orderBy: [{ aliasType: "asc" }, { alias: "asc" }] },
      regionalStatuses: { where: { collectionId: collection.id } },
      husbandryGuide: true,
      variants: {
        where: { collectionId: collection.id, archivedAt: null },
        include: {
          traits: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
          breedingProjects: { orderBy: { startedAt: "desc" }, take: 5 },
          items: { orderBy: { name: "asc" }, take: 8 },
          _count: { select: { items: true, breedingProjects: true, mediaAssets: true, traits: true } }
        },
        orderBy: [{ variantType: "asc" }, { name: "asc" }]
      },
      _count: { select: { items: true } }
    }
  });
  if (!definition) notFound();
  const resolvedGuide = await getResolvedSpeciesHusbandryGuide(definition.id);
  const regionalStatus = definition.regionalStatuses[0];
  const speciesType = (definition.husbandryGuide?.speciesType ?? resolvedGuide?.speciesType ?? inferSpeciesHusbandryType(definition)) as HusbandrySpeciesType;
  const guideFields = {
    ...((resolvedGuide?.fields ?? definition.husbandryGuide?.fields) as Record<string, unknown> | undefined),
    careDifficulty: resolvedGuide?.careDifficulty ?? definition.husbandryGuide?.careDifficulty
  };
  const linkableGuides = await prisma.speciesHusbandryGuide.findMany({
    where: { collectionId: collection.id },
    include: { speciesDefinition: true },
    orderBy: { speciesDefinition: { commonName: "asc" } }
  });

  return (
    <div className="space-y-6">
      <PageHeader title={definition.commonName} eyebrow="Species husbandry" />
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{definition.category}</Badge>
        <Badge>{speciesType}</Badge>
        <Badge>{definition._count.items} linked item(s)</Badge>
        <Link href="/species" className="text-sm font-semibold text-primary underline">Back to species</Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{buildScientificNameWithAuthor(definition)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{definition.notes ?? definition.careNotes ?? "No species notes yet."}</p>
          {[definition.wikipediaUrl, definition.inaturalistUrl, definition.category === "PLANT" ? definition.powoUrl : null, definition.gbifUrl].some(Boolean) ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">References</p><div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-primary">{definition.wikipediaUrl ? <a href={definition.wikipediaUrl} target="_blank" rel="noreferrer" className="underline">Wikipedia</a> : null}{definition.inaturalistUrl ? <a href={definition.inaturalistUrl} target="_blank" rel="noreferrer" className="underline">iNaturalist</a> : null}{definition.category === "PLANT" && definition.powoUrl ? <a href={definition.powoUrl} target="_blank" rel="noreferrer" className="underline">Plants of the World Online</a> : null}{definition.gbifUrl ? <a href={definition.gbifUrl} target="_blank" rel="noreferrer" className="underline">GBIF</a> : null}</div></div> : null}
          {definition.category === "FISH" && definition.maxSize ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maximum size</p><p className="mt-1 text-sm text-primary">{definition.maxSize}</p></div> : null}
          {labelSpeciesBioloadClass(definition.bioloadClass) ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bioload</p><p className="mt-1 text-sm text-primary">{labelSpeciesBioloadClass(definition.bioloadClass)}</p></div> : null}
          {definition.aliases.length ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Also known as</p><div className="mt-2 flex flex-wrap gap-2">{definition.aliases.map((row) => <Badge key={row.id}>{row.alias}</Badge>)}</div></div> : null}
          {definition.husbandryGuide?.status === "LINKED" && resolvedGuide ? <p className="text-sm text-muted-foreground">Linked guide resolved from {resolvedGuide.speciesDefinition?.commonName ?? "source species"}.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Regional status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {regionalStatus ? <>
            <div className="flex flex-wrap items-center gap-2"><RegionalStatusBadge status={regionalStatus.status} />{regionalStatus.confidence ? <Badge>{regionalStatus.confidence} confidence</Badge> : null}</div>
            <p className="text-sm text-muted-foreground">Applies to {regionalStatus.localityLabelSnapshot ?? "an unspecified locality"}{regionalStatus.statusScope ? ` · ${regionalStatus.statusScope}` : ""}{regionalStatus.checkedAt ? ` · checked ${regionalStatus.checkedAt.toLocaleDateString()}` : ""}</p>
            {regionalStatus.notes ? <p className="text-sm">{regionalStatus.notes}</p> : null}
            {regionalStatus.sourceName ? <p className="text-sm">Source: {regionalStatus.sourceUrl ? <a href={regionalStatus.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">{regionalStatus.sourceName}</a> : regionalStatus.sourceName}</p> : null}
            {isConcerningRegionalStatus(regionalStatus.status) ? <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm font-semibold text-amber-900 dark:text-amber-100">{neverReleaseMessage}</p> : null}
            <form action={deleteSpeciesRegionalStatus}><input type="hidden" name="speciesDefinitionId" value={definition.id} /><Button type="submit" variant="secondary">Clear regional status</Button></form>
          </> : <p className="text-sm text-muted-foreground">Regional status is unknown. Add collection locality and use Species Magic Fill, or edit the species manually.</p>}
          <details className="rounded-md border border-border bg-background/45 p-3"><summary className="cursor-pointer font-semibold text-primary">Edit regional status</summary><form action={saveSpeciesRegionalStatusAction} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="speciesDefinitionId" value={definition.id} /><p className="sm:col-span-2 text-xs text-muted-foreground">This update will apply to {collection.localityLabel || buildLocalityLabel(collection) || "the current collection locality"} and will not change the shared species definition.</p><Select name="regionalStatus" defaultValue={regionalStatus?.status ?? "UNKNOWN"}>{regionalSpeciesStatuses.map((status) => <option key={status} value={status}>{regionalStatusLabels[status]}</option>)}</Select><Select name="regionalConfidence" defaultValue={regionalStatus?.confidence ?? ""}><option value="">Confidence not set</option>{regionalStatusConfidences.map((confidence) => <option key={confidence}>{confidence}</option>)}</Select><Input name="regionalStatusScope" placeholder="Scope: country, province, locality…" defaultValue={regionalStatus?.statusScope ?? ""} /><Input name="regionalSourceName" placeholder="Source / authority name" defaultValue={regionalStatus?.sourceName ?? ""} /><Input className="sm:col-span-2" name="regionalSourceUrl" type="url" placeholder="Source URL" defaultValue={regionalStatus?.sourceUrl ?? ""} /><Textarea className="sm:col-span-2" name="regionalNotes" placeholder="Regional context and handling caution" defaultValue={regionalStatus?.notes ?? ""} /><Button className="sm:col-span-2" type="submit">Save regional status</Button></form></details>
          <Link href={`/species?q=${encodeURIComponent(definition.commonName)}`} className="inline-flex text-sm font-semibold text-primary underline">Ask Eddy to re-check regional status from the species editor</Link>
          <p className="text-xs text-muted-foreground">Regional status is advisory and can change. Verify current requirements with the relevant local authority.</p>
        </CardContent>
      </Card>
      <Card id="variants">
        <CardHeader><CardTitle>Variants, strains, localities, and lines</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Variants live under this canonical species. Use them for color morphs, named strains, locality lines, cultivars, trade names, and breeding lines without duplicating taxonomy.</p>
          {definition.variants.length ? <div className="grid gap-3">
            {definition.variants.map((variant) => (
              <details key={variant.id} className="rounded-lg border border-border bg-background/60 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/species/${definition.id}/variants/${variant.id}`} className="text-base font-semibold text-primary underline">{variant.displayName ?? variant.name}</Link>
                      <p className="mt-1 text-sm text-muted-foreground">{variant.description ?? "No variant description yet."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{variant.variantType.replaceAll("_", " ").toLowerCase()}</Badge>
                      <Badge>{variant.status.replaceAll("_", " ").toLowerCase()}</Badge>
                      <Badge>{variant._count.items} item(s)</Badge>
                      <Badge>{variant._count.breedingProjects} project(s)</Badge>
                    </div>
                  </div>
                </summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <VariantForm variant={variant} speciesDefinitionId={definition.id} />
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-primary">Breeding traits</h4>
                      {variant.traits.length ? <div className="mt-2 grid gap-2">{variant.traits.map((trait) => <div key={trait.id} className="rounded-md bg-muted/55 p-2 text-sm"><strong>{trait.name}</strong>{trait.description ? <span className="block text-xs text-muted-foreground">{trait.description}</span> : null}{trait.confidence || trait.observedPercent != null ? <span className="block text-xs text-muted-foreground">{trait.confidence ? `${trait.confidence.toLowerCase()} confidence` : ""}{trait.observedPercent != null ? ` · ${trait.observedPercent}% observed` : ""}</span> : null}</div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">No variant traits yet.</p>}
                    </div>
                    <form action={addSpeciesTrait} className="grid gap-2 rounded-md bg-muted/45 p-3">
                      <input type="hidden" name="speciesDefinitionId" value={definition.id} />
                      <input type="hidden" name="speciesVariantId" value={variant.id} />
                      <Input name="name" placeholder="Trait name" required />
                      <Input name="description" placeholder="Description" />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input name="observedPercent" type="number" min="0" max="100" step="0.1" placeholder="% observed" />
                        <Select name="confidence" defaultValue=""><option value="">Confidence</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CONFIRMED</option></Select>
                        <Select name="desired" defaultValue="on"><option value="on">Desired</option><option value="off">Undesired</option></Select>
                      </div>
                      <Textarea name="notes" placeholder="Trait notes" />
                      <Button type="submit" variant="secondary">Add trait</Button>
                    </form>
                    {variant.breedingProjects.length ? <div><h4 className="text-sm font-semibold text-primary">Breeding projects</h4><div className="mt-2 grid gap-2">{variant.breedingProjects.map((project) => <Link key={project.id} href={`/breeding/${project.id}`} className="rounded-md bg-muted/55 p-2 text-sm font-semibold text-primary underline">{project.title}</Link>)}</div></div> : null}
                    {variant.items.length ? <div><h4 className="text-sm font-semibold text-primary">Inventory</h4><div className="mt-2 grid gap-2">{variant.items.map((item) => <Link key={item.id} href={`/inventory/${item.id}`} className="rounded-md bg-muted/55 p-2 text-sm font-semibold text-primary underline">{item.name}</Link>)}</div></div> : null}
                  </div>
                </div>
              </details>
            ))}
          </div> : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No variants yet. Add one when a record is a morph, strain, locality, cultivar, or breeding line rather than a separate species.</p>}
          <details className="rounded-md border border-border bg-background/45 p-3" open={Boolean(query.createVariant)}>
            <summary className="cursor-pointer font-semibold text-primary">Add variant</summary>
            <VariantForm speciesDefinitionId={definition.id} />
          </details>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Eddy species care summary</CardTitle></CardHeader>
        <CardContent><EddySpeciesAssistant speciesDefinitionId={definition.id} commonName={definition.commonName} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Resolved husbandry</CardTitle></CardHeader>
        <CardContent>
          {resolvedGuide || Object.values(guideFields).some(Boolean) ? (
            <SpeciesHusbandryGuideView
              speciesType={speciesType}
              fields={guideFields}
              editAction={definition.husbandryGuide?.status === "LINKED" ? undefined : saveSpeciesHusbandryGuideFieldAction}
              editTargetName="speciesDefinitionId"
              editTargetId={definition.id}
              title="Species husbandry guide"
              sourceLabel={definition.husbandryGuide?.status === "LINKED" ? "Live-linked guide. Fork before editing local fields." : null}
            />
          ) : <HusbandryEmptyPrompt />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Edit guide</CardTitle></CardHeader>
        <CardContent>
          {definition.husbandryGuide?.status === "LINKED" ? (
            <p className="text-sm text-muted-foreground">This guide is linked. Fork it before editing local fields.</p>
          ) : (
            <SpeciesHusbandryGuideForm action={saveSpeciesHusbandryGuideAction} speciesDefinitionId={definition.id} speciesType={speciesType} guide={definition.husbandryGuide} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Linking</CardTitle></CardHeader>
        <CardContent>
          <HusbandryLinkControls
            speciesDefinitionId={definition.id}
            guides={linkableGuides}
            linkAction={linkSpeciesHusbandryGuideAction}
            forkAction={forkSpeciesHusbandryGuideAction}
            deleteAction={deleteSpeciesHusbandryGuideAction}
            isLinked={definition.husbandryGuide?.status === "LINKED"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function VariantForm({ speciesDefinitionId, variant }: { speciesDefinitionId: string; variant?: any }) {
  return (
    <div className="mt-3 grid gap-3 rounded-md border border-border bg-background/50 p-3">
      <form action={variant ? updateSpeciesVariant : createSpeciesVariant} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="speciesDefinitionId" value={speciesDefinitionId} />
        {variant ? <input type="hidden" name="speciesVariantId" value={variant.id} /> : null}
        <label className="grid gap-1 text-sm font-medium"><span>Variant name</span><Input name="name" defaultValue={variant?.name ?? ""} placeholder="Orange Rili, Kivuli F1, Java Fern Windelov…" required /></label>
        <label className="grid gap-1 text-sm font-medium"><span>Display name</span><Input name="displayName" defaultValue={variant?.displayName ?? ""} placeholder="Optional label for keepers" /></label>
        <label className="grid gap-1 text-sm font-medium"><span>Variant type</span><Select name="variantType" defaultValue={variant?.variantType ?? "OTHER"}><option value="COLOR_MORPH">Color morph</option><option value="STRAIN">Strain</option><option value="LOCALITY">Locality</option><option value="LINE">Line</option><option value="CULTIVAR">Cultivar</option><option value="TRADE_NAME">Trade name</option><option value="OTHER">Other</option></Select></label>
        <label className="grid gap-1 text-sm font-medium"><span>Status</span><Select name="status" defaultValue={variant?.status ?? "IN_PROCESS"}><option value="IN_PROCESS">In process</option><option value="ESTABLISHED">Established</option></Select></label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2"><span>Description</span><Input name="description" defaultValue={variant?.description ?? ""} /></label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2"><span>Notes</span><Textarea name="notes" defaultValue={variant?.notes ?? ""} /></label>
        <Button type="submit" className="sm:col-span-2">{variant ? "Save variant" : "Create variant"}</Button>
      </form>
      {variant ? <form action={archiveSpeciesVariant}><input type="hidden" name="speciesVariantId" value={variant.id} /><Button type="submit" variant="secondary">Archive variant</Button></form> : null}
    </div>
  );
}
