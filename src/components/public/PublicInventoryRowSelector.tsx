"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type PublicInventoryOption = {
  id: string;
  name: string;
  itemType: string;
  selected: boolean;
};

export function PublicInventoryRowSelector({ items }: { items: PublicInventoryOption[] }) {
  const [checked, setChecked] = useState(() => new Set(items.filter((item) => item.selected).map((item) => item.id)));
  const allChecked = items.length > 0 && checked.size === items.length;
  const selectedLabel = useMemo(() => `${checked.size}/${items.length} selected`, [checked.size, items.length]);

  return (
    <div className="rounded-md border border-border bg-muted/35 p-3 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-primary">Public inventory rows</h4>
          <p className="mb-2 text-xs text-muted-foreground">Prices, vendors, private notes, and internal IDs are never shown publicly.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setChecked(allChecked ? new Set() : new Set(items.map((item) => item.id)))}>
          {allChecked ? "Uncheck all" : "Check all"}
        </Button>
      </div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{selectedLabel}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.length ? items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-md bg-background/70 p-2 text-sm">
            <input
              type="checkbox"
              name="publicItemId"
              value={item.id}
              checked={checked.has(item.id)}
              onChange={(event) => {
                const next = new Set(checked);
                if (event.target.checked) next.add(item.id);
                else next.delete(item.id);
                setChecked(next);
              }}
            />
            {item.name} <span className="text-xs text-muted-foreground">({item.itemType.toLowerCase()})</span>
          </label>
        )) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground sm:col-span-2">No eligible inventory or attached equipment rows are available for this aquarium.</div>}
      </div>
    </div>
  );
}
