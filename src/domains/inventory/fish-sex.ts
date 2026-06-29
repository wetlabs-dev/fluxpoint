export type FishSexCounts = {
  maleCountApprox: number | null;
  femaleCountApprox: number | null;
};

function integerOrNull(value: FormDataEntryValue | null | undefined, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a whole number greater than or equal to zero.`);
  return parsed;
}

export function normalizeFishSexCounts(input: {
  itemType: string;
  quantity: number;
  maleCountApprox?: FormDataEntryValue | null;
  femaleCountApprox?: FormDataEntryValue | null;
}): FishSexCounts {
  if (input.itemType !== "FISH") return { maleCountApprox: null, femaleCountApprox: null };
  const maleCountApprox = integerOrNull(input.maleCountApprox, "Male count");
  const femaleCountApprox = integerOrNull(input.femaleCountApprox, "Female count");
  const totalKnown = (maleCountApprox ?? 0) + (femaleCountApprox ?? 0);
  if (totalKnown > input.quantity) throw new Error("Male and female counts cannot exceed the total fish quantity.");
  return { maleCountApprox, femaleCountApprox };
}

export function fishSexCountsAfterQuantityChange(input: {
  itemType: string;
  quantity: number;
  maleCountApprox?: number | null;
  femaleCountApprox?: number | null;
}): FishSexCounts {
  if (input.itemType !== "FISH") return { maleCountApprox: null, femaleCountApprox: null };
  const maleCountApprox = input.maleCountApprox ?? null;
  const femaleCountApprox = input.femaleCountApprox ?? null;
  const totalKnown = (maleCountApprox ?? 0) + (femaleCountApprox ?? 0);
  if (totalKnown > input.quantity) return { maleCountApprox: null, femaleCountApprox: null };
  return { maleCountApprox, femaleCountApprox };
}

export function fishUnsexedCount(input: { itemType: string; quantity: number; maleCountApprox?: number | null; femaleCountApprox?: number | null }) {
  if (input.itemType !== "FISH") return null;
  return Math.max(0, input.quantity - (input.maleCountApprox ?? 0) - (input.femaleCountApprox ?? 0));
}

export function formatFishSexBreakdown(input: { itemType: string; quantity: number; maleCountApprox?: number | null; femaleCountApprox?: number | null }) {
  if (input.itemType !== "FISH") return null;
  const parts = [
    input.maleCountApprox != null ? `${input.maleCountApprox} male` : null,
    input.femaleCountApprox != null ? `${input.femaleCountApprox} female` : null
  ].filter(Boolean) as string[];
  const unsexed = fishUnsexedCount(input);
  if (unsexed != null && (parts.length || unsexed !== input.quantity)) parts.push(`${unsexed} unsexed`);
  return parts.length ? parts.join(" · ") : null;
}
