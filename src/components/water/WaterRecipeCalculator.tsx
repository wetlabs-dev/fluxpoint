"use client";

import { useMemo, useState } from "react";
import { calculateRecipeDose, formatDoseUnit } from "@/domains/water/calculator";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Recipe = {
  id: string;
  name: string;
  waterSourceId: string;
  waterSource?: { name: string } | null;
  targetPh?: number | null;
  targetGh?: number | null;
  targetKh?: number | null;
  targetTds?: number | null;
  targetSalinity?: number | null;
  additives: {
    id: string;
    additiveName: string;
    doseAmount: number;
    doseUnit: string;
    perVolumeAmount: number;
    perVolumeUnit: string;
    instructions?: string | null;
    inventoryItem?: { name: string } | null;
  }[];
};

type Props = {
  recipes: Recipe[];
  defaultRecipeId?: string | null;
  aquariumTargets: {
    salinityMin?: number | null;
    salinityMax?: number | null;
    ph?: number | null;
    gh?: number | null;
    kh?: number | null;
  };
  defaultVolume?: number | null;
  defaultUnit?: "GALLON" | "LITER";
};

export function WaterRecipeCalculator({ recipes, defaultRecipeId, aquariumTargets, defaultVolume, defaultUnit = "GALLON" }: Props) {
  const [recipeId, setRecipeId] = useState(defaultRecipeId ?? recipes[0]?.id ?? "");
  const [amount, setAmount] = useState(String(defaultVolume ?? ""));
  const [unit, setUnit] = useState(defaultUnit);
  const recipe = recipes.find((entry) => entry.id === recipeId) ?? null;
  const volume = Number(amount);
  const rows = useMemo(() => recipe ? recipe.additives.map((additive) => ({
    additive,
    dose: calculateRecipeDose(additive, volume, unit)
  })) : [], [recipe, unit, volume]);
  const mismatches = recipe ? targetMismatches(recipe, aquariumTargets) : [];

  if (!recipes.length) return <p className="text-sm text-muted-foreground">No active water recipes are configured yet. Create one from Collection settings.</p>;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
        <Select value={recipeId} onChange={(event) => setRecipeId(event.target.value)} aria-label="Water recipe">
          {recipes.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.waterSource?.name ? ` · ${entry.waterSource.name}` : ""}</option>)}
        </Select>
        <Input type="number" min="0" step="0.1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" />
        <Select value={unit} onChange={(event) => setUnit(event.target.value as "GALLON" | "LITER")} aria-label="Volume unit"><option value="GALLON">Gallons</option><option value="LITER">Liters</option></Select>
      </div>
      {recipe ? (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {recipe.targetSalinity != null ? <Badge>Target salinity {recipe.targetSalinity} ppt</Badge> : null}
            {recipe.targetPh != null ? <Badge>pH {recipe.targetPh}</Badge> : null}
            {recipe.targetGh != null ? <Badge>GH {recipe.targetGh}</Badge> : null}
            {recipe.targetKh != null ? <Badge>KH {recipe.targetKh}</Badge> : null}
            {recipe.targetTds != null ? <Badge>TDS {recipe.targetTds}</Badge> : null}
          </div>
          {mismatches.length ? <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100">Recipe target differs from this aquarium: {mismatches.join(", ")}.</div> : null}
          {rows.length ? (
            <div className="grid gap-2">
              {rows.map(({ additive, dose }) => (
                <div key={additive.id} className="rounded-md bg-muted/55 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-semibold text-primary">{additive.additiveName}</div>
                    <div className="font-mono text-lg">{Number.isFinite(dose) ? dose.toFixed(dose >= 10 ? 1 : 2) : "0"} {formatDoseUnit(additive.doseUnit)}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">Base dose: {additive.doseAmount} {formatDoseUnit(additive.doseUnit)} per {additive.perVolumeAmount} {additive.perVolumeUnit.toLowerCase()}{additive.inventoryItem?.name ? ` · linked to ${additive.inventoryItem.name}` : ""}</p>
                  {additive.instructions ? <p className="mt-1 text-sm text-muted-foreground">{additive.instructions}</p> : null}
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">This recipe has no additives yet.</p>}
          <p className="text-xs font-semibold text-muted-foreground">Always verify mixed water with tests before adding it to the aquarium.</p>
        </>
      ) : null}
    </div>
  );
}

function targetMismatches(recipe: Recipe, targets: Props["aquariumTargets"]) {
  const mismatches: string[] = [];
  if (recipe.targetPh != null && targets.ph != null && Math.abs(recipe.targetPh - targets.ph) > 0.3) mismatches.push("pH");
  if (recipe.targetGh != null && targets.gh != null && Math.abs(recipe.targetGh - targets.gh) > 2) mismatches.push("GH");
  if (recipe.targetKh != null && targets.kh != null && Math.abs(recipe.targetKh - targets.kh) > 2) mismatches.push("KH");
  if (recipe.targetSalinity != null && ((targets.salinityMin != null && recipe.targetSalinity < targets.salinityMin) || (targets.salinityMax != null && recipe.targetSalinity > targets.salinityMax))) mismatches.push("salinity");
  return mismatches;
}
