"use client";

import { usePathname } from "next/navigation";
import { switchActiveCollection } from "@/domains/collections/actions";

export function CollectionSwitcher({ activeCollectionId, collections, compact = false }: { activeCollectionId: string; collections: Array<{ id: string; name: string }>; compact?: boolean }) {
  const pathname = usePathname();
  if (collections.length < 2) return compact ? null : <div className="truncate text-xs text-muted-foreground">{collections[0]?.name ?? "No collection access"}</div>;
  return <form action={switchActiveCollection} className="grid gap-1">
    <input type="hidden" name="returnTo" value={pathname} />
    <label htmlFor={compact ? "mobile-active-collection" : "active-collection"} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collection</label>
    <select id={compact ? "mobile-active-collection" : "active-collection"} name="collectionId" defaultValue={activeCollectionId} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold text-primary">
      {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
    </select>
  </form>;
}
