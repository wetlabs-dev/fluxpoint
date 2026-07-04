import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionRole } from "@/domains/auth/permissions";
import { activeConditionStatuses, conditionCategories, conditionEntityTypes, conditionLabel, conditionSeverities, conditionStatuses } from "@/domains/conditions/condition-catalog";
import { ConditionCreateForm } from "@/components/conditions/ConditionCreateForm";
import { ConditionBadge } from "@/components/conditions/ConditionBadge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { CreatePanel } from "@/components/forms/CreatePanel";
import { userTimeZone } from "@/lib/dates/user-timezone";

export const dynamic = "force-dynamic";

export default async function ConditionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const timeZone = userTimeZone(user);
  const role = await getCollectionRole(user.id, collection.id);
  const params = await searchParams;
  const where: Prisma.HealthConditionWhereInput = {
    collectionId: collection.id,
    ...(params.aquariumId ? { aquariumId: params.aquariumId } : {}),
    ...(params.category && conditionCategories.includes(params.category as never) ? { category: params.category as never } : {}),
    ...(params.status && conditionStatuses.includes(params.status as never) ? { status: params.status as never } : params.scope === "resolved" ? { status: "RESOLVED" } : { status: { in: activeConditionStatuses } }),
    ...(params.severity && conditionSeverities.includes(params.severity as never) ? { severity: params.severity as never } : {}),
    ...(params.entityType && conditionEntityTypes.includes(params.entityType as never) ? { entityType: params.entityType as never } : {}),
    ...(params.from || params.to ? { firstObservedAt: { ...(params.from ? { gte: new Date(`${params.from}T00:00:00`) } : {}), ...(params.to ? { lte: new Date(`${params.to}T23:59:59.999`) } : {}) } } : {}),
    ...(params.q ? { OR: [{ title: { contains: params.q, mode: "insensitive" } }, { conditionType: { contains: params.q, mode: "insensitive" } }, { summary: { contains: params.q, mode: "insensitive" } }] } : {})
  };
  const [conditions, aquariums, items, species] = await Promise.all([
    prisma.healthCondition.findMany({ where, include: { aquarium: true, _count: { select: { observations: true, careTasks: true, mediaAssets: true } } }, orderBy: [{ severity: "desc" }, { lastObservedAt: "desc" }, { createdAt: "desc" }] }),
    prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    prisma.aquariumItem.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, include: { aquarium: true }, orderBy: { name: "asc" } }),
    prisma.speciesDefinition.findMany({ where: { OR: [{ collectionId: collection.id }, { collectionId: null }] }, orderBy: { commonName: "asc" } })
  ]);
  const canCreate = role === "COLLECTION_OWNER" || role === "AQUARIST";
  return (
    <div className="space-y-6">
      <PageHeader title="Conditions" eyebrow="Cross-entity health and operations"><div className="flex gap-2"><Link href="/conditions"><Button variant="secondary">Active</Button></Link><Link href="/conditions?scope=resolved"><Button variant="ghost">Resolved history</Button></Link></div></PageHeader>
      <Card><CardContent className="p-4"><form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><Input className="sm:col-span-2" name="q" placeholder="Search title, type, or notes" defaultValue={params.q ?? ""} /><Select name="aquariumId" defaultValue={params.aquariumId ?? ""}><option value="">All aquariums</option>{aquariums.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select><Select name="category" defaultValue={params.category ?? ""}><option value="">All categories</option>{conditionCategories.map((value) => <option key={value} value={value}>{conditionLabel(value)}</option>)}</Select><Select name="status" defaultValue={params.status ?? ""}><option value="">Active statuses</option>{conditionStatuses.map((value) => <option key={value} value={value}>{conditionLabel(value)}</option>)}</Select><Select name="severity" defaultValue={params.severity ?? ""}><option value="">All severities</option>{conditionSeverities.map((value) => <option key={value} value={value}>{conditionLabel(value)}</option>)}</Select><Select name="entityType" defaultValue={params.entityType ?? ""}><option value="">All entity types</option>{conditionEntityTypes.map((value) => <option key={value} value={value}>{conditionLabel(value)}</option>)}</Select><Input name="from" type="date" aria-label="Observed from" defaultValue={params.from ?? ""} /><Input name="to" type="date" aria-label="Observed through" defaultValue={params.to ?? ""} /><Button type="submit" variant="secondary">Filter</Button></form></CardContent></Card>
      {canCreate ? <CreatePanel title="Log condition" defaultOpen={Boolean(params.create || params.aquariumId || params.entityType || params.entityId)}><ConditionCreateForm timeZone={timeZone} defaults={{ aquariumId: params.aquariumId, entityType: params.entityType, entityId: params.entityId }} aquariums={aquariums.map((entry) => ({ id: entry.id, label: entry.name }))} items={items.map((entry) => ({ id: entry.id, label: `${entry.name} · ${conditionLabel(entry.itemType)}${entry.aquarium ? ` · ${entry.aquarium.name}` : ""}` }))} species={species.map((entry) => ({ id: entry.id, label: `${entry.commonName}${entry.scientificName ? ` · ${entry.scientificName}` : ""}` }))} /></CreatePanel> : null}
        <Card><CardHeader><CardTitle>{params.scope === "resolved" ? "Resolved conditions" : "Current conditions"}</CardTitle></CardHeader><CardContent className="space-y-3">{conditions.length ? conditions.map((condition) => <Link key={condition.id} href={`/conditions/${condition.id}`} className="block rounded-md border border-border bg-background/55 p-4 transition hover:border-primary/45"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-primary">{condition.title}</div><div className="text-sm text-muted-foreground">{condition.aquarium?.name ?? "Collection-wide"} · {condition.conditionType}</div></div><div className="flex flex-wrap gap-2"><ConditionBadge value={condition.severity} kind="severity" /><ConditionBadge value={condition.status} /></div></div>{condition.summary ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{condition.summary}</p> : null}<div className="mt-3 text-xs text-muted-foreground">{condition._count.observations} observations · {condition._count.careTasks} follow-ups · {condition._count.mediaAssets} photos</div></Link>) : <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No matching conditions. Resolved records remain available in history.</div>}</CardContent></Card>
    </div>
  );
}
