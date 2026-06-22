import { createCondition } from "@/domains/conditions/actions";
import { conditionCategories, conditionEntityTypes, conditionLabel, conditionSeverities, conditionTypesByCategory } from "@/domains/conditions/condition-catalog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

type Entity = { id: string; label: string };

export function ConditionCreateForm({ aquariums, items, species, defaults }: { aquariums: Entity[]; items: Entity[]; species: Entity[]; defaults?: { aquariumId?: string; entityType?: string; entityId?: string } }) {
  const suggestedTypes = Array.from(new Set(Object.values(conditionTypesByCategory).flat()));
  return (
    <form action={createCondition} className="grid gap-3">
      <div className="rounded-md bg-muted/45 p-3 text-xs text-muted-foreground">Track an observed operational issue and its progress. Fluxpoint does not diagnose disease or prescribe treatment.</div>
      <label className="grid gap-1 text-sm font-medium"><span>Aquarium</span><Select name="aquariumId" defaultValue={defaults?.aquariumId ?? ""}><option value="">Collection / no aquarium</option>{aquariums.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</Select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium"><span>Affected entity type</span><Select name="entityType" defaultValue={defaults?.entityType ?? "AQUARIUM"}>{conditionEntityTypes.map((value) => <option key={value} value={value}>{conditionLabel(value)}</option>)}</Select></label>
        <label className="grid gap-1 text-sm font-medium"><span>Affected record</span><Select name="entityId" defaultValue={defaults?.entityId ?? ""}><option value="">Aquarium / system / other</option><optgroup label="Inventory and equipment">{items.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</optgroup><optgroup label="Species">{species.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</optgroup></Select></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium"><span>Category</span><Select name="category" defaultValue="UNKNOWN">{conditionCategories.map((value) => <option key={value} value={value}>{conditionLabel(value)}</option>)}</Select></label>
        <label className="grid gap-1 text-sm font-medium"><span>Condition type</span><Input name="conditionType" list="condition-type-options" placeholder="Choose or enter a custom type" required /><datalist id="condition-type-options">{suggestedTypes.map((value) => <option key={value} value={value} />)}</datalist></label>
      </div>
      <Input name="title" maxLength={160} placeholder="Short operational title" required />
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium"><span>Severity</span><Select name="severity" defaultValue="MODERATE">{conditionSeverities.map((value) => <option key={value} value={value}>{conditionLabel(value)}</option>)}</Select></label>
        <label className="grid gap-1 text-sm font-medium"><span>First observed</span><Input name="firstObservedAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></label>
        <label className="grid gap-1 text-sm font-medium"><span>Follow-up due</span><Input name="followUpDueAt" type="datetime-local" /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2"><Input name="affectedCount" type="number" min="0" step="0.1" placeholder="Affected count" /><Input name="affectedCountLabel" placeholder="fish, shrimp, plants, devices" /></div>
      <Textarea name="summary" placeholder="What did you observe?" required />
      <Textarea name="suspectedCause" placeholder="Possible causes to investigate (optional, not a diagnosis)" />
      <Textarea name="actionPlan" placeholder="Observation or action plan" />
      <Button type="submit">Log condition</Button>
    </form>
  );
}
