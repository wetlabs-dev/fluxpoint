import { createHash } from "crypto";

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function sortValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, sortValue(nested)]));
}

export function daysBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / 86_400_000;
}

export function formatApprox(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "unknown";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}
