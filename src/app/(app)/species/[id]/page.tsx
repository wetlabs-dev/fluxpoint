import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { buildScientificDisplayName } from "@/lib/format/species";
import {
  deleteSpeciesHusbandryGuideAction,
  forkSpeciesHusbandryGuideAction,
  linkSpeciesHusbandryGuideAction,
  saveSpeciesHusbandryGuideAction,
  saveSpeciesHusbandryGuideFieldAction
} from "@/domains/management/actions";
import { getResolvedSpeciesHusbandryGuide } from "@/domains/husbandry/husbandry-service";
import { inferSpeciesHusbandryType, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpeciesHusbandryGuideView } from "@/components/husbandry/SpeciesHusbandryGuideView";
import { SpeciesHusbandryGuideForm } from "@/components/husbandry/SpeciesHusbandryGuideForm";
import { HusbandryLinkControls } from "@/components/husbandry/HusbandryLinkControls";
import { HusbandryEmptyPrompt } from "@/components/husbandry/HusbandryEmptyPrompt";
import { EddySpeciesAssistant } from "@/components/eddy/EddySpeciesAssistant";

export const dynamic = "force-dynamic";

export default async function SpeciesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { id } = await params;
  const definition = await prisma.speciesDefinition.findFirst({
    where: { id, OR: [{ collectionId: collection.id }, { collectionId: null }] },
    include: { aliases: { where: { collectionId: collection.id }, orderBy: [{ aliasType: "asc" }, { alias: "asc" }] }, husbandryGuide: true, _count: { select: { items: true } } }
  });
  if (!definition) notFound();
  const resolvedGuide = await getResolvedSpeciesHusbandryGuide(definition.id);
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
          <CardTitle>{buildScientificDisplayName(definition)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{definition.notes ?? definition.careNotes ?? "No species notes yet."}</p>
          {definition.aliases.length ? <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Also known as</p><div className="mt-2 flex flex-wrap gap-2">{definition.aliases.map((row) => <Badge key={row.id}>{row.alias}</Badge>)}</div></div> : null}
          {definition.husbandryGuide?.status === "LINKED" && resolvedGuide ? <p className="text-sm text-muted-foreground">Linked guide resolved from {resolvedGuide.speciesDefinition?.commonName ?? "source species"}.</p> : null}
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
