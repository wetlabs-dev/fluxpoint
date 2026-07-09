"use client";

import { useMemo, useState } from "react";
import { transferItem } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type QuarantinePickerOption = {
  id: string;
  name: string;
  itemType: string;
  quantityLabel: string;
  placementLabel: string;
  searchText: string;
  filters: string[];
};

const filters = [
  { key: "all", label: "All" },
  { key: "host", label: "Host tank" },
  { key: "livestock", label: "Livestock" },
  { key: "plants", label: "Plants" },
  { key: "equipment", label: "Equipment" },
  { key: "storage", label: "Storage" }
] as const;

export function QuarantineItemPicker({ projectId, options, hostAquariumName }: { projectId: string; options: QuarantinePickerOption[]; hostAquariumName?: string | null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [selectedId, setSelectedId] = useState("");
  const selected = options.find((option) => option.id === selectedId) ?? null;
  const effectiveFilter = hostAquariumName ? filter : filter === "host" ? "all" : filter;
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return options
      .filter((option) => effectiveFilter === "all" || option.filters.includes(effectiveFilter))
      .filter((option) => !normalizedQuery || option.searchText.includes(normalizedQuery))
      .slice(0, 12);
  }, [effectiveFilter, options, query]);

  return (
    <form action={transferItem} className="grid gap-3 rounded-md border border-border bg-background/50 p-3">
      <input type="hidden" name="destinationType" value="QUARANTINE" />
      <input type="hidden" name="toQuarantineProjectId" value={projectId} />
      <input type="hidden" name="itemId" value={selectedId} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(12rem,1fr)_auto] lg:items-end">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground" htmlFor={`quarantine-item-search-${projectId}`}>Add one item</label>
          <Input
            id={`quarantine-item-search-${projectId}`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={hostAquariumName ? `Search ${hostAquariumName} first, or all inventory…` : "Search inventory by name, type, or placement…"}
          />
        </div>
        <Input name="quantity" type="number" step="0.1" min="0.1" defaultValue="1" aria-label="Quantity to add" />
        <Input name="reason" placeholder="Reason" />
        <Button type="submit" variant="secondary" disabled={!selectedId}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((entry) => {
          if (entry.key === "host" && !hostAquariumName) return null;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${effectiveFilter === entry.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/35 text-muted-foreground hover:text-primary"}`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="rounded-md border border-water/30 bg-water/10 p-3 text-sm">
          <div className="font-semibold text-primary">Selected: {selected.name}</div>
          <div className="text-muted-foreground">{selected.quantityLabel} · {selected.itemType} · {selected.placementLabel}</div>
        </div>
      ) : null}
      <div className="grid max-h-72 gap-2 overflow-auto rounded-md border border-border bg-muted/20 p-2">
        {visibleOptions.length ? visibleOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelectedId(option.id)}
            className={`grid gap-1 rounded-md border p-3 text-left transition hover:border-primary hover:bg-primary/5 ${selectedId === option.id ? "border-primary bg-primary/10" : "border-border bg-background/75"}`}
          >
            <span className="font-semibold text-primary">{option.name}</span>
            <span className="text-xs text-muted-foreground">{option.quantityLabel} · {option.itemType} · {option.placementLabel}</span>
          </button>
        )) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No inventory items match this filter.</div>}
      </div>
    </form>
  );
}
