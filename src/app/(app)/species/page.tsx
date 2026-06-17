import { prisma } from "@/lib/db/prisma";
import { createSpecies, deleteSpecies, updateSpecies } from "@/domains/management/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const categories = ["FISH", "INVERT", "PLANT", "CORAL", "OTHER"];

export default async function SpeciesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim();
  const category = params.category && categories.includes(params.category) ? params.category : undefined;
  const species = await prisma.speciesDefinition.findMany({
    where: {
      ...(category ? { category: category as never } : {}),
      ...(query ? {
        OR: [
          { commonName: { contains: query, mode: "insensitive" } },
          { scientificName: { contains: query, mode: "insensitive" } }
        ]
      } : {})
    },
    include: { _count: { select: { items: true } } },
    orderBy: [{ category: "asc" }, { commonName: "asc" }]
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Species" eyebrow="Definition library" />
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <Input name="q" placeholder="Search common or scientific name" defaultValue={query ?? ""} />
            <Select name="category" defaultValue={category ?? ""}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="space-y-4">
          {species.length ? species.map((definition) => (
            <Card key={definition.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{definition.commonName}</CardTitle>
                    <p className="text-sm italic text-muted-foreground">{definition.scientificName ?? "Scientific name not set"}</p>
                  </div>
                  <Badge>{definition.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{definition.careNotes ?? definition.notes ?? "No care notes yet."}</p>
                <details className="rounded-md border border-border bg-background/45 p-3">
                  <summary className="cursor-pointer font-semibold text-primary">Edit species</summary>
                  <SpeciesForm action={updateSpecies} species={definition} />
                </details>
                <form action={deleteSpecies} className="flex items-center justify-between gap-3 rounded-md bg-muted/45 p-3">
                  <input type="hidden" name="id" value={definition.id} />
                  <span className="text-sm text-muted-foreground">{definition._count.items ? `${definition._count.items} linked item(s)` : "Unused definition"}</span>
                  <Button type="submit" variant="secondary" disabled={definition._count.items > 0}>Delete</Button>
                </form>
              </CardContent>
            </Card>
          )) : (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Create your first species definition.</CardContent></Card>
          )}
        </section>
        <Card>
          <CardHeader><CardTitle>Create species</CardTitle></CardHeader>
          <CardContent><SpeciesForm action={createSpecies} /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function SpeciesForm({ action, species }: { action: (formData: FormData) => Promise<void>; species?: Record<string, any> }) {
  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
      {species ? <input type="hidden" name="id" value={species.id} /> : null}
      <Select name="category" defaultValue={species?.category ?? "FISH"}>
        {categories.map((item) => <option key={item}>{item}</option>)}
      </Select>
      <Input name="commonName" placeholder="Common name" defaultValue={species?.commonName ?? ""} required />
      <Input name="scientificName" placeholder="Scientific name" defaultValue={species?.scientificName ?? ""} />
      <Input name="genus" placeholder="Genus" defaultValue={species?.genus ?? ""} />
      <Input name="species" placeholder="Species" defaultValue={species?.species ?? ""} />
      <Input name="variety" placeholder="Variety" defaultValue={species?.variety ?? ""} />
      <Input name="cultivar" placeholder="Cultivar" defaultValue={species?.cultivar ?? ""} />
      <Input name="tempMin" type="number" step="0.1" placeholder="Temp min" defaultValue={species?.tempMin ?? ""} />
      <Input name="tempMax" type="number" step="0.1" placeholder="Temp max" defaultValue={species?.tempMax ?? ""} />
      <Input name="phMin" type="number" step="0.1" placeholder="pH min" defaultValue={species?.phMin ?? ""} />
      <Input name="phMax" type="number" step="0.1" placeholder="pH max" defaultValue={species?.phMax ?? ""} />
      <Input name="ghMin" type="number" step="0.1" placeholder="GH min" defaultValue={species?.ghMin ?? ""} />
      <Input name="ghMax" type="number" step="0.1" placeholder="GH max" defaultValue={species?.ghMax ?? ""} />
      <Input name="khMin" type="number" step="0.1" placeholder="KH min" defaultValue={species?.khMin ?? ""} />
      <Input name="khMax" type="number" step="0.1" placeholder="KH max" defaultValue={species?.khMax ?? ""} />
      <Textarea className="md:col-span-2" name="careNotes" placeholder="Care notes" defaultValue={species?.careNotes ?? ""} />
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes" defaultValue={species?.notes ?? ""} />
      <Button className="md:col-span-2" type="submit">{species ? "Save species" : "Create species"}</Button>
    </form>
  );
}
