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

export const dynamic = "force-dynamic";

const locationTypes = ["ROOM", "RACK", "SHELF", "STAND", "CABINET", "OUTDOOR_AREA", "OTHER"];
const sourceTypes = ["STORE", "ONLINE_VENDOR", "BREEDER", "LOCAL_CLUB", "FRIEND", "IMPORTER", "SELF_PROPAGATED", "OTHER"];

export default async function CollectionPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const role = await getCollectionRole(user.id, collection.id);
  const [counts, locations, sources] = await Promise.all([
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
    })
  ]);
  const [aquariumCount, itemCount, workflowCount] = counts;

  return (
    <div className="space-y-6">
      <PageHeader title="Collection" eyebrow="Operating records">{role === "COLLECTION_OWNER" ? <Link href="/collection/audit-log" className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">View audit log</Link> : null}</PageHeader>
      <Card>
        <CardHeader><CardTitle>{collection.name}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <Info label="Description" value={collection.description} />
          <Info label="Aquariums" value={`${aquariumCount}`} />
          <Info label="Records" value={`${itemCount} items · ${workflowCount} workflows`} />
        </CardContent>
      </Card>
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
      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-water" /> Locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <LocationForm action={createLocation} locations={locations} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-water" /> Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <SourceForm action={createSource} />
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
      <Button className="md:col-span-2" type="submit">{location ? "Save location" : "Add location"}</Button>
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
      <Button className="md:col-span-2" type="submit">{source ? "Save source" : "Add source"}</Button>
    </form>
  );
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
