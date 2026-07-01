import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { createSpecies, deleteSpecies, updateSpecies } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { buildHusbandryBadges, inferSpeciesHusbandryType } from "@/domains/husbandry/husbandry-fields";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatePanel } from "@/components/forms/CreatePanel";
import { Input, Select } from "@/components/ui/input";
import { buildScientificNameWithAuthor } from "@/lib/format/species";
import { habitatsForSalinity } from "@/domains/species/habitat";
import { SpeciesForm } from "@/components/species/SpeciesForm";
import { RegionalStatusBadge } from "@/components/species/RegionalStatusBadge";
import { buildLocalityLabel, concerningRegionalStatuses, hasRegionalLookupLocality } from "@/domains/species/regional-status";
import { co2RequirementLabels } from "@/domains/species/co2";
import { labelSpeciesBioloadClass } from "@/domains/species/bioload";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const categories = ["FISH", "INVERT", "PLANT", "CORAL", "OTHER"];

export default async function SpeciesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; create?: string; createType?: string; regionalStatus?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const params = await searchParams;
  const query = params.q?.trim();
  const category = params.category && categories.includes(params.category) ? params.category : undefined;
  const createType = params.createType && categories.includes(params.createType) ? params.createType : "FISH";
  const regionalFilter = params.regionalStatus ?? "";
  let regionalCondition: Prisma.SpeciesDefinitionWhereInput | null = null;
  if (regionalFilter === "UNKNOWN") regionalCondition = { OR: [{ regionalStatuses: { none: { collectionId: collection.id } } }, { regionalStatuses: { some: { collectionId: collection.id, status: "UNKNOWN" } } }] };
  if (regionalFilter === "CONCERNING") regionalCondition = { regionalStatuses: { some: { collectionId: collection.id, status: { in: concerningRegionalStatuses } } } };
  if (regionalFilter === "WATCHLIST") regionalCondition = { regionalStatuses: { some: { collectionId: collection.id, status: "WATCHLIST" } } };
  if (regionalFilter === "INVASIVE") regionalCondition = { regionalStatuses: { some: { collectionId: collection.id, status: "INVASIVE" } } };
  if (regionalFilter === "RESTRICTED") regionalCondition = { regionalStatuses: { some: { collectionId: collection.id, status: { in: ["RESTRICTED", "PROHIBITED"] } } } };
  const queryFilter = query ? {
    OR: [
      { commonName: { contains: query, mode: "insensitive" as const } },
      { scientificName: { contains: query, mode: "insensitive" as const } },
      { genus: { contains: query, mode: "insensitive" as const } },
      { species: { contains: query, mode: "insensitive" as const } },
      { aliases: { some: { collectionId: collection.id, alias: { contains: query, mode: "insensitive" as const } } } },
      { variants: { some: { collectionId: collection.id, archivedAt: null, OR: [{ name: { contains: query, mode: "insensitive" as const } }, { displayName: { contains: query, mode: "insensitive" as const } }] } } }
    ]
  } : null;
  const species = await prisma.speciesDefinition.findMany({
    where: {
      AND: [
        { OR: [{ collectionId: collection.id }, { collectionId: null }] },
        ...(queryFilter ? [queryFilter] : []),
        ...(regionalCondition ? [regionalCondition] : [])
      ],
      ...(category ? { category: category as never } : {}),
    },
    include: { aliases: { where: { collectionId: collection.id }, orderBy: [{ aliasType: "asc" }, { alias: "asc" }] }, regionalStatuses: { where: { collectionId: collection.id } }, husbandryGuide: true, variants: { where: { collectionId: collection.id, archivedAt: null }, include: { _count: { select: { items: true, breedingProjects: true, traits: true } } }, orderBy: [{ variantType: "asc" }, { name: "asc" }] }, items: { include: { aquarium: true, storageLocation: true, quarantineProject: true, speciesVariant: true }, orderBy: { name: "asc" } }, _count: { select: { items: true, breedingProjects: true, variants: true } } },
    orderBy: [{ category: "asc" }, { commonName: "asc" }]
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Species" eyebrow="Definition library" />
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]">
            <Input name="q" placeholder="Search common or scientific name" defaultValue={query ?? ""} />
            <Select name="category" defaultValue={category ?? ""}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </Select>
            <Select name="regionalStatus" defaultValue={regionalFilter}><option value="">All regional statuses</option><option value="CONCERNING">Concerning only</option><option value="UNKNOWN">Unknown</option><option value="WATCHLIST">Watchlist</option><option value="INVASIVE">Invasive</option><option value="RESTRICTED">Restricted / prohibited</option></Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
        </CardContent>
      </Card>
      <CreatePanel title="Create species" defaultOpen={Boolean(params.create || params.createType)}>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((item) => (
              <Link
                key={item}
                href={`/species?createType=${item}`}
                aria-current={createType === item ? "page" : undefined}
                className={`rounded-md border px-3 py-2 text-center text-sm font-semibold transition ${createType === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/70 text-muted-foreground hover:bg-muted"}`}
              >
                {categoryLabel(item)}
              </Link>
            ))}
          </div>
          <SpeciesForm key={createType} action={createSpecies} fixedCategory={createType} collectionLocality={{ label: collection.localityLabel || buildLocalityLabel(collection), ready: hasRegionalLookupLocality(collection) }} />
      </CreatePanel>
      <section className="space-y-4">
          {species.length ? species.map((definition) => (
            <Card key={definition.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{definition.commonName}</CardTitle>
                    <p className="text-sm italic text-muted-foreground">{buildScientificNameWithAuthor(definition)}</p>
                  </div>
                  <Badge>{definition.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{definition.careNotes ?? definition.notes ?? "No care notes yet."}</p>
                {[definition.wikipediaUrl, definition.inaturalistUrl, definition.category === "PLANT" ? definition.powoUrl : null, definition.gbifUrl].some(Boolean) ? <div className="flex flex-wrap gap-3 text-xs font-semibold text-primary">{definition.wikipediaUrl ? <a href={definition.wikipediaUrl} target="_blank" rel="noreferrer" className="underline">Wikipedia</a> : null}{definition.inaturalistUrl ? <a href={definition.inaturalistUrl} target="_blank" rel="noreferrer" className="underline">iNaturalist</a> : null}{definition.category === "PLANT" && definition.powoUrl ? <a href={definition.powoUrl} target="_blank" rel="noreferrer" className="underline">POWO</a> : null}{definition.gbifUrl ? <a href={definition.gbifUrl} target="_blank" rel="noreferrer" className="underline">GBIF</a> : null}</div> : null}
                {definition.category === "FISH" && definition.maxSize ? <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Maximum size:</span> {definition.maxSize}</p> : null}
                {labelSpeciesBioloadClass(definition.bioloadClass) ? <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Bioload:</span> {labelSpeciesBioloadClass(definition.bioloadClass)}</p> : null}
                {definition.category === "PLANT" ? <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">CO₂ requirement:</span> {co2RequirementLabels[definition.co2Requirement]}</p> : null}
                {definition.aliases.length ? <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Also known as:</span> {definition.aliases.map((row) => row.alias).join(", ")}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {definition.collectionId === null ? <Badge>Seeded starter definition</Badge> : null}
                  {habitatsForSalinity(definition.salinityMin, definition.salinityMax).map((habitat) => <Badge key={habitat}>✓ {habitat}</Badge>)}
                  {buildHusbandryBadges((definition.husbandryGuide?.speciesType ?? inferSpeciesHusbandryType(definition)) as never, { ...(definition.husbandryGuide?.fields as Record<string, unknown> | undefined), careDifficulty: definition.husbandryGuide?.careDifficulty }).map((badge) => (
                    <Badge key={`${definition.id}-${badge.key}`}>{badge.label}</Badge>
                  ))}
                  {definition.regionalStatuses[0] && concerningRegionalStatuses.includes(definition.regionalStatuses[0].status) ? <RegionalStatusBadge status={definition.regionalStatuses[0].status} /> : null}
                </div>
                <Link href={`/species/${definition.id}`} className="inline-flex text-sm font-semibold text-primary underline">Open husbandry workspace</Link>
                <div className="rounded-md border border-border bg-background/45 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-primary">Variants and lines</div>
                    <Link href={`/species/${definition.id}#variants`} className="text-xs font-semibold text-primary underline">Manage variants</Link>
                  </div>
                  {definition.variants.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {definition.variants.map((variant) => (
                      <Link key={variant.id} href={`/species/${definition.id}/variants/${variant.id}`} className="rounded-md bg-muted/55 p-3 text-sm hover:bg-muted">
                        <span className="block font-semibold text-primary">{variant.displayName ?? variant.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{variant.variantType.replaceAll("_", " ").toLowerCase()} · {variant.status.replaceAll("_", " ").toLowerCase()}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{variant._count.items} item(s) · {variant._count.breedingProjects} project(s) · {variant._count.traits} trait(s)</span>
                      </Link>
                    ))}
                  </div> : <p className="text-xs text-muted-foreground">No variants yet. Use variants for named morphs, localities, strains, lines, cultivars, or trade names under this species.</p>}
                </div>
                <details className="rounded-md border border-border bg-background/45 p-3">
                  <summary className="cursor-pointer font-semibold text-primary">Edit species</summary>
                  <SpeciesForm action={updateSpecies} species={definition} collectionLocality={{ label: collection.localityLabel || buildLocalityLabel(collection), ready: hasRegionalLookupLocality(collection) }} />
                </details>
                <details className="rounded-md bg-muted/45 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-primary">{definition._count.items ? `${definition._count.items} linked inventory item${definition._count.items === 1 ? "" : "s"}` : "No linked inventory items"}</summary>
                  {definition.items.length ? <div className="mt-3 space-y-2">{definition.items.map((item) => <div key={item.id} className="grid gap-1 rounded-md border border-border bg-background/65 p-3 text-sm sm:grid-cols-[1fr_auto_auto]"><Link href={`/inventory?q=${encodeURIComponent(item.name)}`} className="font-semibold text-primary underline">{item.name}</Link><span>{item.speciesVariant?.displayName ?? item.speciesVariant?.name ?? "Base species"}</span><span>{item.quantity} {item.unit ?? ""}</span><span className="text-muted-foreground">{item.aquarium?.generatedName ?? item.aquarium?.name ?? item.storageLocation?.name ?? item.quarantineProject?.name ?? "Unassigned"} · {item.status.toLowerCase()}</span></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">This definition is not referenced by inventory.</p>}
                </details>
                <form action={deleteSpecies} className="flex items-center justify-between gap-3 rounded-md bg-muted/45 p-3">
                  <input type="hidden" name="id" value={definition.id} />
                  <span className="text-sm text-muted-foreground">{definition._count.items ? "This species cannot be deleted while inventory items reference it." : definition.collectionId === null ? "Seeded starter definitions are protected." : "Unused definition"}</span>
                  <Button type="submit" variant="secondary" disabled={definition._count.items > 0 || definition.collectionId === null}>Delete</Button>
                </form>
              </CardContent>
            </Card>
          )) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Create your first species definition.</CardContent></Card>
          )}
      </section>
    </div>
  );
}

function categoryLabel(category: string) {
  if (category === "INVERT") return "Invertebrate";
  return category.charAt(0) + category.slice(1).toLowerCase();
}
