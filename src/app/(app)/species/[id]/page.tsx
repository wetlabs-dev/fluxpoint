import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { buildScientificDisplayName } from "@/lib/format/species";
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
import { EddySpeciesAssistant } from "@/components/eddy/EddySpeciesAssistant";
import { RegionalStatusBadge } from "@/components/species/RegionalStatusBadge";
import { buildLocalityLabel, isConcerningRegionalStatus, neverReleaseMessage, regionalSpeciesStatuses, regionalStatusConfidences, regionalStatusLabels } from "@/domains/species/regional-status";

export const dynamic = "force-dynamic";

export default async function SpeciesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { id } = await params;
  const definition = await prisma.speciesDefinition.findFirst({
    where: { id, OR: [{ collectionId: collection.id }, { collectionId: null }] },
    include: { aliases: { where: { collectionId: collection.id }, orderBy: [{ aliasType: "asc" }, { alias: "asc" }] }, regionalStatuses: { where: { collectionId: collection.id } }, husbandryGuide: true, _count: { select: { items: true } } }
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
          <CardTitle>{buildScientificDisplayName(definition)}{definition.authorCitation ? ` ${definition.authorCitation}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{definition.notes ?? definition.careNotes ?? "No species notes yet."}</p>
          {[definition.wikipediaUrl, definition.inaturalistUrl, definition.category === "PLANT" ? definition.powoUrl : null, definition.gbifUrl].some(Boolean) ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">References</p><div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-primary">{definition.wikipediaUrl ? <a href={definition.wikipediaUrl} target="_blank" rel="noreferrer" className="underline">Wikipedia</a> : null}{definition.inaturalistUrl ? <a href={definition.inaturalistUrl} target="_blank" rel="noreferrer" className="underline">iNaturalist</a> : null}{definition.category === "PLANT" && definition.powoUrl ? <a href={definition.powoUrl} target="_blank" rel="noreferrer" className="underline">Plants of the World Online</a> : null}{definition.gbifUrl ? <a href={definition.gbifUrl} target="_blank" rel="noreferrer" className="underline">GBIF</a> : null}</div></div> : null}
          {definition.category === "FISH" && definition.maxSize ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maximum size</p><p className="mt-1 text-sm text-primary">{definition.maxSize}</p></div> : null}
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
