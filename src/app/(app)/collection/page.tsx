import { MapPin, Store } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { createLocation, createSource, deleteLocation, deleteSource, updateCollectionLocality, updateLocation, updateSource } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { buildLocationPath } from "@/lib/format/location";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { getCollectionRole } from "@/domains/auth/permissions";
import { CreateSubmitActions } from "@/components/forms/CreateSubmitActions";
import { saveCollectionPublicSettings } from "@/domains/public/actions";
import { publicCollectionPath } from "@/domains/public/public-utils";
import { addWaterRecipeAdditive, archiveWaterRecipe, createWaterRecipe, createWaterSource, deleteWaterRecipeAdditive, deleteWaterSource, updateWaterRecipe, updateWaterSource } from "@/domains/water/actions";

export const dynamic = "force-dynamic";

const locationTypes = ["ROOM", "RACK", "SHELF", "STAND", "CABINET", "OUTDOOR_AREA", "OTHER"];
const sourceTypes = ["STORE", "ONLINE_VENDOR", "BREEDER", "LOCAL_CLUB", "FRIEND", "IMPORTER", "SELF_PROPAGATED", "OTHER"];
const waterSourceTypes = ["RODI", "TAP", "WELL", "RAIN", "SPRING", "MIXED", "OTHER"];
const waterDoseUnits = ["G", "MG", "TSP", "TBSP", "ML", "DROPS", "CAPFUL", "SCOOP", "OTHER"];
const waterVolumeUnits = ["GALLON", "LITER"];

export default async function CollectionPage({ searchParams }: { searchParams?: Promise<{ create?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const role = await getCollectionRole(user.id, collection.id);
  const params = await searchParams;
  const [counts, locations, sources, publicProfile, waterSources, waterRecipes, additiveItems] = await Promise.all([
    Promise.all([
      prisma.aquarium.count({ where: { collectionId: collection.id } }),
      prisma.aquariumItem.count({ where: { collectionId: collection.id } }),
      prisma.workflowRun.count({ where: { aquarium: { collectionId: collection.id } } })
    ]),
    prisma.location.findMany({
      where: { collectionId: collection.id },
      include: { parent: { include: { parent: true } }, _count: { select: { aquariums: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.source.findMany({
      where: { collectionId: collection.id },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" }
    }),
    prisma.collectionPublicProfile.findUnique({ where: { collectionId: collection.id } }),
    prisma.waterSource.findMany({ where: { collectionId: collection.id }, include: { _count: { select: { aquariums: true, recipes: true } } }, orderBy: [{ archivedAt: "asc" }, { isDefault: "desc" }, { name: "asc" }] }),
    prisma.waterRecipe.findMany({ where: { collectionId: collection.id }, include: { waterSource: true, additives: { include: { inventoryItem: true }, orderBy: [{ sortOrder: "asc" }, { additiveName: "asc" }] }, _count: { select: { aquariums: true } } }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.aquariumItem.findMany({ where: { collectionId: collection.id, itemType: { in: ["ADDITIVE", "MEDICATION", "OTHER"] }, status: { notIn: ["ARCHIVED", "CONSUMED", "REMOVED"] } }, orderBy: { name: "asc" } })
  ]);
  const [aquariumCount, itemCount, workflowCount] = counts;

  return (
    <div className="space-y-6">
      <PageHeader title="Collection" eyebrow="Operating records">
        <div className="flex flex-wrap gap-2">
          <Link href="/collection/tank-summaries" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">Summarize all tanks</Link>
          {role === "COLLECTION_OWNER" ? <Link href="/collection/audit-log" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">View audit log</Link> : null}
        </div>
      </PageHeader>
      <Card>
        <CardHeader><CardTitle>{collection.name}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <Info label="Description" value={collection.description} />
          <Info label="Aquariums" value={`${aquariumCount}`} />
          <Info label="Records" value={`${itemCount} items · ${workflowCount} workflows`} />
        </CardContent>
      </Card>
      {role === "COLLECTION_OWNER" ? (
        <Card>
          <CardHeader><CardTitle>Public Browse settings</CardTitle><p className="text-sm text-muted-foreground">Nothing is public unless enabled here and individual aquariums are published.</p></CardHeader>
          <CardContent>
            <form action={saveCollectionPublicSettings} className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" name="isPublicEnabled" defaultChecked={Boolean(publicProfile?.isPublicEnabled)} /> Enable public collection browse</label>
              <Input name="publicSlug" placeholder="public-slug" defaultValue={publicProfile?.publicSlug ?? collection.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} />
              <Input name="displayName" placeholder="Public display name" defaultValue={publicProfile?.displayName ?? collection.name} />
              <Input name="tagline" placeholder="Tagline" defaultValue={publicProfile?.tagline ?? ""} />
              <Select name="publicLocationMode" defaultValue={publicProfile?.publicLocationMode ?? "HIDDEN"}><option value="HIDDEN">Hide location</option><option value="REGION_ONLY">Region only</option><option value="CITY_STATE_COUNTRY">City, state, country</option></Select>
              <Textarea className="md:col-span-2" name="description" placeholder="Public description" defaultValue={publicProfile?.description ?? ""} />
              <div className="grid gap-2 text-sm md:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["showOwnerName", "Show owner name", false],
                  ["showTankList", "Show tank list", true],
                  ["showSpeciesList", "Show species list", true],
                  ["showMetrics", "Allow metrics sections", false],
                  ["showTimeline", "Allow timeline sections", false],
                  ["showEquipment", "Allow equipment sections", false],
                  ["showQrLandingPages", "Enable public QR landing", true],
                  ["allowSearchIndexing", "Allow search indexing", false]
                ].map(([name, label, fallback]) => <label key={String(name)} className="flex items-center gap-2 rounded-md bg-muted/45 p-2"><input type="checkbox" name={String(name)} defaultChecked={publicProfile ? Boolean((publicProfile as any)[String(name)]) : Boolean(fallback)} /> {label}</label>)}
              </div>
              <div className="flex flex-wrap gap-3 md:col-span-2"><Button type="submit">Save public settings</Button>{publicProfile ? <Link href={publicCollectionPath(publicProfile.publicSlug)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary">Preview public page</Link> : null}</div>
              {publicProfile ? <p className="text-xs text-muted-foreground md:col-span-2">Public URL: {publicCollectionPath(publicProfile.publicSlug)} · {publicProfile.isPublicEnabled ? "Enabled" : "Disabled"}</p> : null}
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-water" /> Collection locality</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Used for regional invasive-status checks, local care context, weather-aware features, and future local alerts. This does not need to be a precise address.</p>
          {role === "COLLECTION_OWNER" ? (
            <form action={updateCollectionLocality} className="grid gap-3 md:grid-cols-2">
              <Input name="localityCity" placeholder="City / locality" defaultValue={collection.localityCity ?? ""} />
              <Input name="localityRegion" placeholder="State / province / region" defaultValue={collection.localityRegion ?? ""} />
              <label className="grid gap-1"><span className="text-sm font-medium">Country code</span><Input name="localityCountry" placeholder="US, GB, AU, CA…" maxLength={2} defaultValue={collection.localityCountry ?? ""} /><span className="text-xs text-muted-foreground">Optional two-letter ISO country code. Country plus a city, region, or postal code enables regional checking.</span></label>
              <label className="grid gap-1"><span className="text-sm font-medium">Postal code (optional)</span><Input name="localityPostalCode" placeholder="Postal code" defaultValue={collection.localityPostalCode ?? ""} /></label>
              <Input className="md:col-span-2" name="localityLabel" placeholder="Display label (generated if blank)" defaultValue={collection.localityLabel ?? ""} />
              <Textarea className="md:col-span-2" name="localityNotes" placeholder="Locality notes" defaultValue={collection.localityNotes ?? ""} />
              <Button className="md:col-span-2" type="submit">Save collection locality</Button>
            </form>
          ) : <Info label="Configured locality" value={collection.localityLabel ?? [collection.localityCity, collection.localityRegion, collection.localityCountry].filter(Boolean).join(", ")} />}
        </CardContent>
      </Card>
      <section className="grid gap-5">
        <Card id="water-sources" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DropletsIcon /> Water sources</CardTitle>
            <p className="text-sm text-muted-foreground">Reusable source-water records for aquariums and Eddy context. Old freeform tank water-source text remains preserved, but new tank forms use these records.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <details open={Boolean(params?.create)} className="rounded-md border border-border bg-muted/35 p-3"><summary className="cursor-pointer font-semibold text-primary">Add water source</summary><WaterSourceForm action={createWaterSource} /></details>
            {waterSources.length ? waterSources.map((source) => (
              <details key={source.id} className="rounded-md border border-border bg-background/55 p-3" open={false}>
                <summary className="cursor-pointer">
                  <span className="font-semibold text-primary">{source.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{source.sourceType.toLowerCase()} · {source._count.aquariums} tank(s) · {source._count.recipes} recipe(s)</span>
                  {source.isDefault ? <Badge className="ml-2">default</Badge> : null}
                  {source.archivedAt ? <Badge className="ml-2">archived</Badge> : null}
                </summary>
                <WaterSourceForm action={updateWaterSource} source={source} />
                <WaterSourceDeleteForm source={source} />
              </details>
            )) : <EmptyLine text="No water sources yet." />}
          </CardContent>
        </Card>

        <Card id="water-recipes" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DropletsIcon /> Water recipes</CardTitle>
            <p className="text-sm text-muted-foreground">Define repeatable mixing recipes and optional additive doses. Aquarium pages can scale these by water-change volume.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <details open={Boolean(params?.create)} className="rounded-md border border-border bg-muted/35 p-3"><summary className="cursor-pointer font-semibold text-primary">Add water recipe</summary><WaterRecipeForm action={createWaterRecipe} waterSources={waterSources.filter((source) => !source.archivedAt)} /></details>
            {waterRecipes.length ? waterRecipes.map((recipe) => (
              <details key={recipe.id} className="rounded-md border border-border bg-background/55 p-3">
                <summary className="cursor-pointer">
                  <span className="font-semibold text-primary">{recipe.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{recipe.waterSource.name} · {recipe.additives.length} additive(s) · {recipe._count.aquariums} tank(s)</span>
                  {!recipe.isActive ? <Badge className="ml-2">archived</Badge> : null}
                </summary>
                <WaterRecipeForm action={updateWaterRecipe} recipe={recipe} waterSources={waterSources.filter((source) => !source.archivedAt)} />
                <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/25 p-3">
                  <h4 className="font-semibold text-primary">Additives</h4>
                  {recipe.additives.length ? recipe.additives.map((additive) => (
                    <div key={additive.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-background/75 p-2 text-sm">
                      <div><strong>{additive.additiveName}</strong><span className="text-muted-foreground"> · {additive.doseAmount} {additive.doseUnit.toLowerCase()} per {additive.perVolumeAmount} {additive.perVolumeUnit.toLowerCase()}{additive.inventoryItem ? ` · ${additive.inventoryItem.name}` : ""}</span></div>
                      <form action={deleteWaterRecipeAdditive}><input type="hidden" name="id" value={additive.id} /><Button type="submit" variant="ghost">Remove</Button></form>
                    </div>
                  )) : <EmptyLine text="No additives in this recipe yet." />}
                  <WaterRecipeAdditiveForm recipeId={recipe.id} items={additiveItems} />
                </div>
                {recipe.isActive ? <form action={archiveWaterRecipe} className="mt-3"><input type="hidden" name="id" value={recipe.id} /><Button type="submit" variant="secondary">Archive recipe</Button></form> : null}
              </details>
            )) : <EmptyLine text="No water recipes yet." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-water" /> Locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <details open={Boolean(params?.create)} className="rounded-md border border-border bg-muted/35 p-3"><summary className="cursor-pointer font-semibold text-primary">Add location</summary><LocationForm action={createLocation} locations={locations} /></details>
            {locations.length ? locations.map((location) => (
              <details key={location.id} className="rounded-md border border-border bg-background/55 p-3">
                <summary className="cursor-pointer">
                  <span className="font-semibold text-primary">{buildLocationPath(location)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{location._count.aquariums} tanks</span>
                  <Badge className="ml-2">{location.type}</Badge>
                </summary>
                <LocationForm action={updateLocation} locations={locations} location={location} />
                <form action={deleteLocation} className="mt-3">
                  <input type="hidden" name="id" value={location.id} />
                  <Button type="submit" variant="secondary">Delete location</Button>
                </form>
              </details>
            )) : <EmptyLine text="No structured locations yet." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-water" /> Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <details open={Boolean(params?.create)} className="rounded-md border border-border bg-muted/35 p-3"><summary className="cursor-pointer font-semibold text-primary">Add source</summary><SourceForm action={createSource} /></details>
            {sources.length ? sources.map((source) => (
              <details key={source.id} className="rounded-md border border-border bg-background/55 p-3">
                <summary className="cursor-pointer">
                  <span className="font-semibold text-primary">{source.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{source._count.items} items</span>
                  <Badge className="ml-2">{source.type}</Badge>
                </summary>
                <SourceForm action={updateSource} source={source} />
                <form action={deleteSource} className="mt-3">
                  <input type="hidden" name="id" value={source.id} />
                  <Button type="submit" variant="secondary">Delete source</Button>
                </form>
              </details>
            )) : <EmptyLine text="No structured sources yet." />}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function LocationForm({ action, locations, location }: { action: (formData: FormData) => Promise<void>; locations: any[]; location?: any }) {
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-2">
      {location ? <input type="hidden" name="id" value={location.id} /> : null}
      <Input name="name" placeholder="Location name" defaultValue={location?.name ?? ""} required />
      <Select name="type" defaultValue={location?.type ?? "ROOM"}>
        {locationTypes.map((type) => <option key={type}>{type}</option>)}
      </Select>
      <Select name="parentId" defaultValue={location?.parentId ?? ""}>
        <option value="">No parent</option>
        {locations.filter((item) => item.id !== location?.id).map((item) => <option key={item.id} value={item.id}>{buildLocationPath(item)}</option>)}
      </Select>
      <Input name="sortOrder" type="number" placeholder="Sort order" defaultValue={location?.sortOrder ?? ""} />
      <Textarea className="md:col-span-2" name="description" placeholder="Description" defaultValue={location?.description ?? ""} />
      {location ? <Button className="md:col-span-2" type="submit">Save location</Button> : <CreateSubmitActions label="Add location" addAnotherLabel="Add & Add Another" cancelHref="/collection" className="md:col-span-2" />}
    </form>
  );
}

function WaterSourceForm({ action, source }: { action: (formData: FormData) => Promise<void>; source?: any }) {
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-2">
      {source ? <input type="hidden" name="id" value={source.id} /> : null}
      <Input name="name" placeholder="Source name" defaultValue={source?.name ?? ""} required />
      <Select name="sourceType" defaultValue={source?.sourceType ?? "OTHER"}>{waterSourceTypes.map((type) => <option key={type}>{type}</option>)}</Select>
      <Textarea className="md:col-span-2" name="description" placeholder="Description" defaultValue={source?.description ?? ""} />
      <Input name="baselinePh" type="number" step="0.1" placeholder="Baseline pH" defaultValue={source?.baselinePh ?? ""} />
      <Input name="baselineGh" type="number" step="0.1" placeholder="Baseline GH" defaultValue={source?.baselineGh ?? ""} />
      <Input name="baselineKh" type="number" step="0.1" placeholder="Baseline KH" defaultValue={source?.baselineKh ?? ""} />
      <Input name="baselineTds" type="number" step="1" placeholder="Baseline TDS" defaultValue={source?.baselineTds ?? ""} />
      <Input name="baselineSalinity" type="number" step="0.1" placeholder="Baseline salinity (ppt)" defaultValue={source?.baselineSalinity ?? ""} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" defaultChecked={Boolean(source?.isDefault)} /> Default / commonly used</label>
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes" defaultValue={source?.notes ?? ""} />
      {source ? <Button className="md:col-span-2" type="submit">Save water source</Button> : <CreateSubmitActions label="Add water source" addAnotherLabel="Add & Add Another" cancelHref="/collection" className="md:col-span-2" />}
    </form>
  );
}

function WaterSourceDeleteForm({ source }: { source: any }) {
  const usageCount = (source?._count?.aquariums ?? 0) + (source?._count?.recipes ?? 0);
  return (
    <form action={deleteWaterSource} className="mt-3 rounded-md border border-border bg-background/70 p-3">
      <input type="hidden" name="id" value={source.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {usageCount === 0
            ? "This source is unused and can be permanently deleted."
            : `Used by ${source._count.aquariums} tank(s) and ${source._count.recipes} recipe(s). Move those records before deleting.`}
        </p>
        <Button type="submit" variant="secondary" disabled={usageCount > 0} className="disabled:cursor-not-allowed disabled:opacity-50">Delete unused source</Button>
      </div>
    </form>
  );
}

function WaterRecipeForm({ action, recipe, waterSources }: { action: (formData: FormData) => Promise<void>; recipe?: any; waterSources: any[] }) {
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-2">
      {recipe ? <input type="hidden" name="id" value={recipe.id} /> : null}
      <Select name="waterSourceId" defaultValue={recipe?.waterSourceId ?? waterSources[0]?.id ?? ""} required>{waterSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</Select>
      <Input name="name" placeholder="Recipe name" defaultValue={recipe?.name ?? ""} required />
      <Textarea className="md:col-span-2" name="description" placeholder="Description" defaultValue={recipe?.description ?? ""} />
      <Input name="targetPh" type="number" step="0.1" placeholder="Target pH" defaultValue={recipe?.targetPh ?? ""} />
      <Input name="targetGh" type="number" step="0.1" placeholder="Target GH" defaultValue={recipe?.targetGh ?? ""} />
      <Input name="targetKh" type="number" step="0.1" placeholder="Target KH" defaultValue={recipe?.targetKh ?? ""} />
      <Input name="targetTds" type="number" step="1" placeholder="Target TDS" defaultValue={recipe?.targetTds ?? ""} />
      <Input name="targetSalinity" type="number" step="0.1" placeholder="Target salinity (ppt)" defaultValue={recipe?.targetSalinity ?? ""} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inactive" defaultChecked={recipe ? !recipe.isActive : false} /> Archive / inactive</label>
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes" defaultValue={recipe?.notes ?? ""} />
      {recipe ? <Button className="md:col-span-2" type="submit">Save water recipe</Button> : <CreateSubmitActions label="Add water recipe" addAnotherLabel="Add & Add Another" cancelHref="/collection" className="md:col-span-2" />}
    </form>
  );
}

function WaterRecipeAdditiveForm({ recipeId, items }: { recipeId: string; items: any[] }) {
  return (
    <form action={addWaterRecipeAdditive} className="grid gap-2 rounded-md bg-background/65 p-3 md:grid-cols-2">
      <input type="hidden" name="waterRecipeId" value={recipeId} />
      <Input name="additiveName" placeholder="Additive name" required />
      <Select name="inventoryItemId" defaultValue=""><option value="">No linked inventory item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.itemType.toLowerCase()}</option>)}</Select>
      <Input name="doseAmount" type="number" min="0" step="0.01" placeholder="Dose amount" required />
      <Select name="doseUnit" defaultValue="ML">{waterDoseUnits.map((unit) => <option key={unit}>{unit}</option>)}</Select>
      <Input name="perVolumeAmount" type="number" min="0.01" step="0.01" placeholder="Per volume amount" defaultValue="1" required />
      <Select name="perVolumeUnit" defaultValue="GALLON">{waterVolumeUnits.map((unit) => <option key={unit}>{unit}</option>)}</Select>
      <Input name="sortOrder" type="number" placeholder="Sort order" />
      <Input name="instructions" placeholder="Instructions" />
      <Button className="md:col-span-2" type="submit" variant="secondary">Add additive</Button>
    </form>
  );
}

function SourceForm({ action, source }: { action: (formData: FormData) => Promise<void>; source?: any }) {
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-2">
      {source ? <input type="hidden" name="id" value={source.id} /> : null}
      <Input name="name" placeholder="Source name" defaultValue={source?.name ?? ""} required />
      <Select name="type" defaultValue={source?.type ?? "STORE"}>
        {sourceTypes.map((type) => <option key={type}>{type}</option>)}
      </Select>
      <Input className="md:col-span-2" name="website" placeholder="Website" defaultValue={source?.website ?? ""} />
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes" defaultValue={source?.notes ?? ""} />
      {source ? <Button className="md:col-span-2" type="submit">Save source</Button> : <CreateSubmitActions label="Add source" addAnotherLabel="Add & Add Another" cancelHref="/collection" className="md:col-span-2" />}
    </form>
  );
}

function DropletsIcon() {
  return <span aria-hidden className="text-water">♒</span>;
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-primary">{value ?? "Not set"}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}
