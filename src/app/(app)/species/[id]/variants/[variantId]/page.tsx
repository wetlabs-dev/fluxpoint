import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { buildScientificNameWithAuthor } from "@/lib/format/species";
import { addSpeciesTrait, archiveSpeciesVariant, updateSpeciesVariant } from "@/domains/breeding/actions";

export const dynamic = "force-dynamic";

export default async function SpeciesVariantPage({ params }: { params: Promise<{ id: string; variantId: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { id, variantId } = await params;
  const variant = await prisma.speciesVariant.findFirst({
    where: { id: variantId, speciesDefinitionId: id, collectionId: collection.id },
    include: {
      speciesDefinition: true,
      traits: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      items: { include: { aquarium: true, storageLocation: true, quarantineProject: true }, orderBy: [{ itemType: "asc" }, { name: "asc" }] },
      breedingProjects: { include: { aquarium: true }, orderBy: { startedAt: "desc" } },
      mediaAssets: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });
  if (!variant || variant.archivedAt) notFound();
  const title = variant.displayName ?? variant.name;

  return (
    <div className="space-y-6">
      <PageHeader title={title} eyebrow="Species variant" />
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{variant.variantType.replaceAll("_", " ").toLowerCase()}</Badge>
        <Badge>{variant.status.replaceAll("_", " ").toLowerCase()}</Badge>
        <Badge>{variant.items.length} inventory item(s)</Badge>
        <Link href={`/species/${variant.speciesDefinitionId}`} className="text-sm font-semibold text-primary underline">Back to species</Link>
      </div>

      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{variant.description ?? "No variant description yet."}</p>
          <div className="rounded-md bg-muted/45 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Parent species</div>
            <Link href={`/species/${variant.speciesDefinitionId}`} className="mt-1 block text-sm font-semibold text-primary underline">{variant.speciesDefinition.commonName}</Link>
            <div className="text-sm italic text-muted-foreground">{buildScientificNameWithAuthor(variant.speciesDefinition)}</div>
          </div>
          {variant.notes ? <p className="whitespace-pre-wrap text-sm">{variant.notes}</p> : null}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader><CardTitle>Breeding traits</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {variant.traits.length ? variant.traits.map((trait) => (
              <div key={trait.id} className="rounded-md border border-border bg-background/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-primary">{trait.name}</div>
                  <div className="flex flex-wrap gap-2">{trait.desired ? <Badge>desired</Badge> : <Badge>undesired</Badge>}{trait.confidence ? <Badge>{trait.confidence.toLowerCase()}</Badge> : null}</div>
                </div>
                {trait.description ? <p className="mt-1 text-sm text-muted-foreground">{trait.description}</p> : null}
                {trait.observedPercent != null ? <p className="mt-1 text-xs text-muted-foreground">{trait.observedPercent}% observed</p> : null}
                {trait.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{trait.notes}</p> : null}
              </div>
            )) : <p className="text-sm text-muted-foreground">No traits recorded for this variant.</p>}
            <form action={addSpeciesTrait} className="grid gap-2 rounded-md bg-muted/45 p-3">
              <input type="hidden" name="speciesDefinitionId" value={variant.speciesDefinitionId} />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Edit variant</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form action={updateSpeciesVariant} className="grid gap-3">
              <input type="hidden" name="speciesVariantId" value={variant.id} />
              <Input name="name" defaultValue={variant.name} required />
              <Input name="displayName" defaultValue={variant.displayName ?? ""} placeholder="Display name" />
              <Select name="variantType" defaultValue={variant.variantType}><option value="COLOR_MORPH">Color morph</option><option value="STRAIN">Strain</option><option value="LOCALITY">Locality</option><option value="LINE">Line</option><option value="CULTIVAR">Cultivar</option><option value="TRADE_NAME">Trade name</option><option value="OTHER">Other</option></Select>
              <Select name="status" defaultValue={variant.status}><option value="IN_PROCESS">In process</option><option value="ESTABLISHED">Established</option></Select>
              <Input name="description" defaultValue={variant.description ?? ""} placeholder="Description" />
              <Textarea name="notes" defaultValue={variant.notes ?? ""} placeholder="Notes" />
              <Button type="submit">Save variant</Button>
            </form>
            <form action={archiveSpeciesVariant}>
              <input type="hidden" name="speciesVariantId" value={variant.id} />
              <Button type="submit" variant="secondary">Archive variant</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Inventory using this variant</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {variant.items.length ? variant.items.map((item) => <Link key={item.id} href={`/inventory/${item.id}`} className="block rounded-md bg-muted/45 p-3 text-sm font-semibold text-primary underline">{item.name}<span className="block text-xs font-normal text-muted-foreground">{item.quantity} {item.unit ?? "units"} · {item.aquarium?.generatedName ?? item.aquarium?.name ?? item.storageLocation?.name ?? item.quarantineProject?.name ?? "Unassigned"}</span></Link>) : <p className="text-sm text-muted-foreground">No inventory items are assigned to this variant yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Breeding projects</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {variant.breedingProjects.length ? variant.breedingProjects.map((project) => <Link key={project.id} href={`/breeding/${project.id}`} className="block rounded-md bg-muted/45 p-3 text-sm font-semibold text-primary underline">{project.title}<span className="block text-xs font-normal text-muted-foreground">{project.status.toLowerCase()} · {project.aquarium?.generatedName ?? project.aquarium?.name ?? "No aquarium"}</span></Link>) : <p className="text-sm text-muted-foreground">No breeding projects target this variant yet.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
