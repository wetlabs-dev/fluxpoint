import Link from "next/link";
import { format } from "date-fns";
import { ClipboardCheck, GitCompareArrows, PackagePlus } from "lucide-react";
import type { AquariumPlanItemType, AquariumPlanPurchaseStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CreatePanel } from "@/components/forms/CreatePanel";
import { AquariumPlanProgress } from "@/components/aquarium-plans/AquariumPlanProgress";
import { addAquariumPlanItem, activatePlannedAquarium, cancelAquariumPlan, completeRevisionPlan, implementPlanItemAction, skipAquariumPlanItem, updateAquariumPlanItemStatus } from "@/domains/aquarium-plans/actions";
import { calculateAquariumPlanProgress, type AquariumPlanProgress as Progress } from "@/domains/aquarium-plans/progress";

type Option = { id: string; label: string; category?: string | null; itemType?: string; equipmentType?: string | null; variants?: { id: string; label: string }[] };

type WorkspaceProps = {
  plan: any;
  progress: Progress;
  speciesOptions: Option[];
  variantOptions: Option[];
  inventoryOptions: Option[];
  equipmentOptions: Option[];
  workflowOptions: Option[];
  waterSourceOptions: Option[];
  waterRecipeOptions: Option[];
};

const itemTypes: AquariumPlanItemType[] = ["TASK", "LIVESTOCK_ADD", "PLANT_ADD", "ORGANISM_ADD", "EQUIPMENT_ATTACH", "EQUIPMENT_REMOVE", "EQUIPMENT_REPLACE", "WATER_TARGET_CHANGE", "AQUARIUM_PROFILE_CHANGE", "WATER_SOURCE_CHANGE", "WATER_RECIPE_CHANGE", "WORKFLOW", "PHOTO", "MAINTENANCE", "OTHER"];
const purchaseStatuses: AquariumPlanPurchaseStatus[] = ["NOT_NEEDED", "TO_PURCHASE", "ORDERED", "ACQUIRED"];

export function AquariumPlanWorkspace({ plan, progress, speciesOptions, variantOptions, inventoryOptions, equipmentOptions, workflowOptions, waterSourceOptions, waterRecipeOptions }: WorkspaceProps) {
  const groups = groupItems(plan.items);
  const estimatedTotal = sumMoney(plan.items.map((item: any) => item.estimatedTotalCost ?? item.estimatedUnitCost));
  const actualTotal = sumMoney(plan.items.map((item: any) => item.actualCost));
  const projected = buildProjection(plan);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{plan.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description ?? (plan.planType === "INITIAL_SETUP" ? "Initial setup staging plan." : "Revision staging plan.")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{plan.planType.replaceAll("_", " ").toLowerCase()}</Badge>
              <Badge>{plan.status.toLowerCase().replaceAll("_", " ")}</Badge>
              <Badge>v{plan.version}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AquariumPlanProgress progress={progress} />
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <Info label="Aquarium" value={plan.aquarium.name} />
            <Info label="Target date" value={plan.targetCompletionDate ? format(plan.targetCompletionDate, "MMM d, yyyy") : "No target"} />
              <Info label="Estimated spend" value={estimatedTotal ? `$${estimatedTotal.toFixed(2)}` : "Not tracked"} />
              <Info label="Actual spend" value={actualTotal ? `$${actualTotal.toFixed(2)}` : "Not tracked"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/aquariums/${plan.aquariumId}`} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary">Back to aquarium</Link>
            {plan.planType === "INITIAL_SETUP" && progress.readyToComplete && plan.status !== "COMPLETED" ? (
              <form action={activatePlannedAquarium}><input type="hidden" name="planId" value={plan.id} /><Button type="submit">Activate aquarium</Button></form>
            ) : null}
            {plan.planType === "REVISION" && progress.readyToComplete && plan.status !== "COMPLETED" ? (
              <form action={completeRevisionPlan} className="flex gap-2"><input type="hidden" name="planId" value={plan.id} /><Input name="notes" placeholder="Completion notes" /><Button type="submit">Complete revision</Button></form>
            ) : null}
            {!["COMPLETED", "CANCELLED", "ARCHIVED"].includes(plan.status) ? (
              <form action={cancelAquariumPlan}><input type="hidden" name="planId" value={plan.id} /><Button type="submit" variant="secondary">Cancel plan</Button></form>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-water" /> Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {groups.length ? groups.map(([category, items]) => (
                <section key={category} className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{category}</h3>
                  <div className="grid gap-3">
                    {items.map((item: any) => <PlanItemCard key={item.id} item={item} />)}
                  </div>
                </section>
              )) : <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No plan items yet. Stage tasks, livestock, equipment, or target changes to build the plan.</div>}
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-5">
          <CreatePanel title="Stage plan item" defaultOpen={false}>
            <PlanItemForm planId={plan.id} speciesOptions={speciesOptions} variantOptions={variantOptions} inventoryOptions={inventoryOptions} equipmentOptions={equipmentOptions} workflowOptions={workflowOptions} waterSourceOptions={waterSourceOptions} waterRecipeOptions={waterRecipeOptions} />
          </CreatePanel>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-water" /> Planned state</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ProjectionRow label="Projected livestock/plants" value={projected.inhabitants.length ? projected.inhabitants.join(" · ") : "No planned additions"} />
              <ProjectionRow label="Projected equipment changes" value={projected.equipment.length ? projected.equipment.join(" · ") : "No equipment changes"} />
              <ProjectionRow label="Projected target/profile changes" value={projected.profile.length ? projected.profile.join(" · ") : "No target changes"} />
              <p className="rounded-md bg-muted/45 p-3 text-xs text-muted-foreground">Projection is labeled future-state only. These items do not affect current inventory, public pages, stocking pressure, alerts, or dashboard totals until implemented.</p>
            </CardContent>
          </Card>
          {plan.planType === "REVISION" ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><GitCompareArrows className="h-5 w-5 text-water" /> Current vs planned</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {projected.diffs.length ? projected.diffs.map((diff, index) => <div key={index} className="rounded-md bg-muted/45 p-2">{diff}</div>) : <p>No operational differences staged yet.</p>}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function PlanItemCard({ item }: { item: any }) {
  const blockedBy = item.dependencies?.filter((dependency: any) => !["IMPLEMENTED", "SKIPPED"].includes(dependency.dependsOnPlanItem.status)).map((dependency: any) => dependency.dependsOnPlanItem.title) ?? [];
  return (
    <article className="rounded-lg border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-primary">{item.title}</h4>
            <Badge>{item.itemType.toLowerCase().replaceAll("_", " ")}</Badge>
            <Badge>{item.status.toLowerCase().replaceAll("_", " ")}</Badge>
            {item.isRequired ? <Badge>required</Badge> : <Badge>optional</Badge>}
          </div>
          {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {item.plannedQuantity ? <span>qty {String(item.plannedQuantity)} {item.plannedUnit ?? ""}</span> : null}
            {item.targetSpeciesDefinition ? <span>{item.targetSpeciesDefinition.commonName}</span> : null}
            {item.targetSpeciesVariant ? <span>{item.targetSpeciesVariant.displayName ?? item.targetSpeciesVariant.name}</span> : null}
            {item.targetEquipmentItem ? <span>{item.targetEquipmentItem.name}</span> : null}
            {item.estimatedTotalCost || item.estimatedUnitCost ? <span>est. ${String(item.estimatedTotalCost ?? item.estimatedUnitCost)}</span> : null}
            {item.purchaseStatus !== "NOT_NEEDED" ? <span>{item.purchaseStatus.toLowerCase().replaceAll("_", " ")}</span> : null}
          </div>
          {blockedBy.length ? <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-200">Waiting for: {blockedBy.join(", ")}</p> : null}
          {item.implementationError ? <p className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{item.implementationError}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!["IMPLEMENTED", "SKIPPED", "CANCELLED"].includes(item.status) ? (
            <form action={implementPlanItemAction}><input type="hidden" name="itemId" value={item.id} /><Button type="submit" className="min-h-9 px-3 py-1 text-xs">Implement</Button></form>
          ) : null}
          {!["IMPLEMENTED", "SKIPPED", "CANCELLED"].includes(item.status) ? (
            <form action={skipAquariumPlanItem} className="flex gap-1"><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="skipReason" value="Skipped from plan workspace." /><Button type="submit" className="min-h-9 px-3 py-1 text-xs" variant="secondary">Skip</Button></form>
          ) : null}
          {!["IMPLEMENTED", "SKIPPED", "CANCELLED"].includes(item.status) ? (
            <form action={updateAquariumPlanItemStatus} className="flex gap-1">
              <input type="hidden" name="itemId" value={item.id} />
              <Select name="status" defaultValue={item.status} className="h-9 text-xs">
                {["PLANNED", "READY", "BLOCKED", "IN_PROGRESS", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}
              </Select>
              <Button type="submit" className="min-h-9 px-3 py-1 text-xs" variant="secondary">Set</Button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PlanItemForm({ planId, speciesOptions, variantOptions, inventoryOptions, equipmentOptions, workflowOptions, waterSourceOptions, waterRecipeOptions }: { planId: string; speciesOptions: Option[]; variantOptions: Option[]; inventoryOptions: Option[]; equipmentOptions: Option[]; workflowOptions: Option[]; waterSourceOptions: Option[]; waterRecipeOptions: Option[] }) {
  return (
    <form action={addAquariumPlanItem} className="grid gap-3">
      <input type="hidden" name="planId" value={planId} />
      <label className="grid gap-1 text-sm font-medium">Type<Select name="itemType" defaultValue="TASK">{itemTypes.map((type) => <option key={type}>{type}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Category<Input name="category" placeholder="Fish, Equipment, Readiness…" /></label>
      <label className="grid gap-1 text-sm font-medium">Title<Input name="title" required placeholder="Add 10 ember tetras" /></label>
      <label className="grid gap-1 text-sm font-medium">Description<Textarea name="description" /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">Quantity<Input name="plannedQuantity" type="number" min="0" step="0.001" /></label>
        <label className="grid gap-1 text-sm font-medium">Unit<Input name="plannedUnit" placeholder="fish, plants, item…" /></label>
      </div>
      <label className="grid gap-1 text-sm font-medium">Species / variant<Select name="targetSpeciesDefinitionId"><option value="">No species</option>{speciesOptions.map((species) => <option key={species.id} value={species.id}>{species.label}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Variant<Select name="targetSpeciesVariantId"><option value="">No variant</option>{variantOptions.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Existing inventory<Select name="targetInventoryItemId"><option value="">No inventory item</option>{inventoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Equipment to attach/remove<Select name="targetEquipmentItemId"><option value="">No equipment item</option>{equipmentOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label>
      <label className="grid gap-1 text-sm font-medium">Replacement inventory<Select name="replacementInventoryItemId"><option value="">No replacement</option>{inventoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">Role<Input name="role" placeholder="FILTER, LIGHT, HEATER…" /></label>
        <label className="grid gap-1 text-sm font-medium">Workflow<Select name="targetWorkflowTemplateId"><option value="">No workflow</option>{workflowOptions.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.label}</option>)}</Select></label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">Water source<Select name="waterSourceId"><option value="">No change</option>{waterSourceOptions.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</Select></label>
        <label className="grid gap-1 text-sm font-medium">Water recipe<Select name="waterRecipeId"><option value="">No change</option>{waterRecipeOptions.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}</Select></label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="targetTemperature" placeholder="Target temp" />
        <Input name="targetPh" placeholder="Target pH" />
        <Input name="targetGh" placeholder="Target GH" />
        <Input name="targetKh" placeholder="Target KH" />
        <Input name="targetSalinityMinPpt" placeholder="Min salinity ppt" />
        <Input name="targetSalinityMaxPpt" placeholder="Max salinity ppt" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">Estimated unit cost<Input name="estimatedUnitCost" type="number" min="0" step="0.01" /></label>
        <label className="grid gap-1 text-sm font-medium">Purchase status<Select name="purchaseStatus">{purchaseStatuses.map((status) => <option key={status}>{status}</option>)}</Select></label>
      </div>
      <label className="grid gap-1 text-sm font-medium">Vendor/source<Input name="vendor" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRequired" defaultChecked /> Required</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="logToTimeline" /> Log to timeline when implemented</label>
      <Button type="submit">Add plan item</Button>
    </form>
  );
}

function groupItems(items: any[]) {
  const map = new Map<string, any[]>();
  for (const item of items) {
    const category = item.category || item.itemType.toLowerCase().replaceAll("_", " ");
    map.set(category, [...(map.get(category) ?? []), item]);
  }
  return Array.from(map.entries());
}

function sumMoney(values: unknown[]): number {
  return values.reduce<number>((sum, value) => sum + (Number(value) || 0), 0);
}

function buildProjection(plan: any) {
  const inhabitants: string[] = [];
  const equipment: string[] = [];
  const profile: string[] = [];
  const diffs: string[] = [];
  for (const item of plan.items.filter((entry: any) => !["IMPLEMENTED", "CANCELLED", "SKIPPED"].includes(entry.status))) {
    if (["LIVESTOCK_ADD", "PLANT_ADD", "ORGANISM_ADD"].includes(item.itemType)) {
      const label = `${item.plannedQuantity ?? "?"} ${item.targetSpeciesVariant?.displayName ?? item.targetSpeciesVariant?.name ?? item.targetSpeciesDefinition?.commonName ?? item.title}`;
      inhabitants.push(label);
      diffs.push(`Add ${label}`);
    }
    if (["EQUIPMENT_ATTACH", "EQUIPMENT_REMOVE", "EQUIPMENT_REPLACE"].includes(item.itemType)) {
      const label = `${item.itemType.toLowerCase().replaceAll("_", " ")}: ${item.targetEquipmentItem?.name ?? item.title}`;
      equipment.push(label);
      diffs.push(label);
    }
    if (["WATER_TARGET_CHANGE", "AQUARIUM_PROFILE_CHANGE", "WATER_SOURCE_CHANGE", "WATER_RECIPE_CHANGE"].includes(item.itemType)) {
      profile.push(item.title);
      diffs.push(item.title);
    }
  }
  return { inhabitants, equipment, profile, diffs };
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/45 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 font-semibold text-primary">{value}</div></div>;
}

function ProjectionRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/45 p-3"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><p className="mt-1 text-primary">{value}</p></div>;
}
