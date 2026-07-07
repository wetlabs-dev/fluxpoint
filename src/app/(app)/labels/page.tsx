import Link from "next/link";
import { Box, Download, ExternalLink, QrCode } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { getCollectionRole } from "@/domains/auth/permissions";
import { generateBulkLabelsAction } from "@/domains/labels/actions";
import { labelTypeLabels } from "@/domains/labels/label-types";
import { PageHeader } from "@/components/layout/page-header";
import { LabelFormatSelector } from "@/components/labels/LabelFormatSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const entityFilters = ["all", "aquariums", "inventory", "equipment", "livestock-plants", "storage-items"] as const;
const itemTypes = ["FISH", "INVERT", "PLANT", "SUBSTRATE", "HARDSCAPE", "EQUIPMENT", "BOTANICAL", "FOOD", "MEDICATION", "ADDITIVE", "OTHER"];
const itemStatuses = ["ACTIVE", "IN_AQUARIUM", "IN_STORAGE", "IN_QUARANTINE", "ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"];
const speciesCategories = ["FISH", "INVERT", "PLANT", "CORAL", "OTHER"];
const equipmentTypes = ["HEATER", "LIGHT", "FILTER", "PUMP", "AIR_PUMP", "CO2", "SENSOR", "CONTROLLER", "DOSER", "OTHER"];
const equipmentRoles = ["LIGHT", "FILTER", "HEATER", "SUBSTRATE", "CO2", "AERATION", "CONTROLLER", "PUMP", "CHILLER", "UV", "DOSER", "AUTO_TOP_OFF", "MONITOR", "OTHER"];
const batchLabelTypes = ["SIMPLE_QR", "ENTITY_DETAIL", "EQUIPMENT_DETAIL", "TANK_DETAIL"] as const;
type EntityFilter = (typeof entityFilters)[number];

export default async function LabelsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const role = await getCollectionRole(user.id, collection.id);
  const canGenerate = role !== "VIEWER";
  const params = await searchParams;
  const entity: EntityFilter = entityFilters.includes(params.entity as EntityFilter) ? (params.entity as EntityFilter) : "all";
  const query = params.q?.trim();
  const aquariumId = params.aquariumId || "";
  const storageLocationId = params.storageLocationId || "";
  const itemType = itemTypes.includes(params.itemType || "") ? params.itemType! : "";
  const status = itemStatuses.includes(params.status || "") ? params.status! : "";
  const speciesCategory = speciesCategories.includes(params.speciesCategory || "") ? params.speciesCategory! : "";
  const equipmentType = equipmentTypes.includes(params.equipmentType || "") ? params.equipmentType! : "";
  const equipmentRole = equipmentRoles.includes(params.equipmentRole || "") ? params.equipmentRole! : "";

  const [aquariums, locations, items, generated] = await Promise.all([
    prisma.aquarium.findMany({ where: { collectionId: collection.id }, orderBy: { name: "asc" }, select: { id: true, name: true, aquariumType: true, targetSalinityMinPpt: true, targetSalinityMaxPpt: true } }),
    prisma.location.findMany({ where: { collectionId: collection.id, type: { in: ["BIN", "DRAWER", "REFRIGERATOR", "FREEZER", "CABINET", "SHELF"] } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.aquariumItem.findMany({
      where: {
        collectionId: collection.id,
        ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { speciesDefinition: { commonName: { contains: query, mode: "insensitive" } } }, { speciesDefinition: { scientificName: { contains: query, mode: "insensitive" } } }] } : {}),
        ...(aquariumId ? { aquariumId } : {}),
        ...(storageLocationId ? { storageLocationId } : {}),
        ...(itemType ? { itemType: itemType as never } : {}),
        ...(status ? { status: status as never } : {}),
        ...(speciesCategory ? { speciesDefinition: { category: speciesCategory as never } } : {}),
        ...(equipmentType ? { equipmentProfile: { equipmentType: equipmentType as never } } : {}),
        ...(equipmentRole ? { equipmentAttachments: { some: { role: equipmentRole as never } } } : {}),
        ...(entity === "equipment" ? { itemType: "EQUIPMENT" as const } : {}),
        ...(entity === "livestock-plants" ? { itemType: { in: ["FISH", "INVERT", "PLANT"] as never[] } } : {}),
        ...(entity === "storage-items" ? { OR: [{ storageLocationId: { not: null } }, { status: "IN_STORAGE" as const }] } : {})
      } satisfies Prisma.AquariumItemWhereInput,
      include: { aquarium: true, storageLocation: true, speciesDefinition: true, equipmentProfile: true },
      orderBy: [{ itemType: "asc" }, { name: "asc" }],
      take: 160
    }),
    prisma.generatedLabel.findMany({ where: { collectionId: collection.id, entityType: "BULK_LABEL_BATCH" }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);

  const aquariumRecords = entity === "inventory" || entity === "equipment" || entity === "livestock-plants" || entity === "storage-items"
    ? []
    : aquariums.filter((tank) => !query || `${tank.name} ${tank.name}`.toLowerCase().includes(query.toLowerCase()));
  const records = [
    ...aquariumRecords.map((tank) => ({ key: `TANK:${tank.id}`, kind: "Tank", name: tank.name, meta: tank.aquariumType.toLowerCase().replaceAll("_", " ") })),
    ...items.filter((item) => entity !== "aquariums").map((item) => ({ key: `${item.itemType === "EQUIPMENT" ? "EQUIPMENT" : "INVENTORY"}:${item.id}`, kind: item.itemType === "EQUIPMENT" ? "Equipment" : item.itemType.toLowerCase(), name: item.name, meta: [item.speciesDefinition?.commonName, item.equipmentProfile?.equipmentType, item.aquarium?.name ?? item.storageLocation?.name ?? item.status.toLowerCase()].filter(Boolean).join(" · ") }))
  ].slice(0, 160);

  return (
    <div className="space-y-6">
      <PageHeader title="Labels" eyebrow="Batch QR and printable labels"><Badge>{records.length} matching records</Badge></PageHeader>
      <Card data-docs-target="label-filter-panel">
        <CardHeader><CardTitle><QrCode className="mr-2 inline h-5 w-5" />Filter label batch</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Select name="entity" defaultValue={entity}>{entityFilters.map((option) => <option key={option} value={option}>{option.replaceAll("-", " ")}</option>)}</Select>
            <Input name="q" placeholder="Search name or species" defaultValue={query ?? ""} />
            <Select name="aquariumId" defaultValue={aquariumId}><option value="">All tanks</option>{aquariums.map((tank) => <option key={tank.id} value={tank.id}>{tank.name}</option>)}</Select>
            <Select name="storageLocationId" defaultValue={storageLocationId}><option value="">All storage locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</Select>
            <Select name="itemType" defaultValue={itemType}><option value="">All item types</option>{itemTypes.map((value) => <option key={value}>{value}</option>)}</Select>
            <Select name="status" defaultValue={status}><option value="">All statuses</option>{itemStatuses.map((value) => <option key={value}>{value}</option>)}</Select>
            <Select name="speciesCategory" defaultValue={speciesCategory}><option value="">All species categories</option>{speciesCategories.map((value) => <option key={value}>{value}</option>)}</Select>
            <Select name="equipmentType" defaultValue={equipmentType}><option value="">All equipment types</option>{equipmentTypes.map((value) => <option key={value}>{value}</option>)}</Select>
            <Select name="equipmentRole" defaultValue={equipmentRole}><option value="">All equipment roles</option>{equipmentRoles.map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
        </CardContent>
      </Card>
      <Card data-docs-target="label-generation-panel">
        <CardHeader><CardTitle><Box className="mr-2 inline h-5 w-5" />Generate selected labels</CardTitle><p className="text-sm text-muted-foreground">Rows are selected by default. Deselect anything you do not want in this batch.</p></CardHeader>
        <CardContent>
          {canGenerate ? <form action={generateBulkLabelsAction} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
              <Input name="batchSummary" placeholder="Optional batch note" />
              <Select name="labelType" defaultValue={entity === "equipment" ? "EQUIPMENT_DETAIL" : entity === "aquariums" ? "TANK_DETAIL" : "ENTITY_DETAIL"}>{batchLabelTypes.map((type) => <option key={type} value={type}>{labelTypeLabels[type]}</option>)}</Select>
              <Button type="submit">Generate PDF</Button>
            </div>
            <LabelFormatSelector initialMode={entity === "all" ? "QR_ONLY" : "FULL"} initialFormat="ONE_PER_PAGE_2_25X1_25" />
            <div className="max-h-[32rem] space-y-2 overflow-auto rounded-md border border-border p-2">
              {records.length ? records.map((record) => <label key={record.key} className="flex items-start gap-3 rounded-md bg-muted/35 p-3 text-sm"><input className="mt-1" type="checkbox" name="record" value={record.key} defaultChecked /><span><strong className="text-primary">{record.name}</strong><span className="block text-xs text-muted-foreground">{record.kind} · {record.meta}</span></span></label>) : <p className="p-4 text-sm text-muted-foreground">No matching records. Adjust filters before generating labels.</p>}
            </div>
          </form> : <p className="text-sm text-muted-foreground">Viewer access can review existing batches; Fishkeeper access or above is required to generate labels.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent label batches</CardTitle><p className="text-sm text-muted-foreground">Open in a browser tab for print controls, or download/share from the installed app.</p></CardHeader>
        <CardContent className="space-y-2">
          {params.generated ? <div className="rounded-md border border-emerald-500/35 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">Label batch generated. Use Open/Print or Download below.</div> : null}
          {generated.length ? generated.map((label) => <div key={label.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/60 p-3 text-sm"><span><strong className="text-primary">{labelTypeLabels[label.labelType]}</strong><span className="block text-xs text-muted-foreground">{label.createdAt.toLocaleString()} · {Math.ceil(label.sizeBytes / 1024)} KB</span></span><span className="flex gap-2"><Link href={`/api/labels/${label.id}`} target="_blank" className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-semibold text-primary hover:bg-muted"><ExternalLink className="mr-1 h-3.5 w-3.5" />Open / Print</Link><Link href={`/api/labels/${label.id}?download=1`} className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-semibold text-primary hover:bg-muted"><Download className="mr-1 h-3.5 w-3.5" />Download</Link></span></div>) : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No batch labels generated yet.</p>}
          <p className="text-xs text-muted-foreground">If print controls do not appear in the installed app, open the PDF in Safari/browser or download/share it first.</p>
        </CardContent>
      </Card>
    </div>
  );
}
