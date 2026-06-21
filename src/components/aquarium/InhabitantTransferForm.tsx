"use client";

import { useState } from "react";
import { transferItem } from "@/domains/management/actions";
import { speciesMatchesAquariumSalinity } from "@/domains/species/habitat";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export function InhabitantTransferForm({ items, aquariums, storageLocations, quarantineProjects }: any) {
  const [itemId, setItemId] = useState("");
  const selected = items.find((item: any) => item.id === itemId);
  const compatibleAquariums = aquariums.filter((aquarium: any) => !selected?.speciesDefinition || speciesMatchesAquariumSalinity(aquarium.salinity, selected.speciesDefinition.salinityMin, selected.speciesDefinition.salinityMax));
  return (
    <form action={transferItem} className="grid gap-3">
      <Select name="itemId" required value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">Choose inhabitant</option>{items.map((item: any) => <option key={item.id} value={item.id}>{item.name} · qty {item.quantity}</option>)}</Select>
      <Select name="destinationType" required defaultValue="AQUARIUM"><option value="AQUARIUM">Another aquarium</option><option value="STORAGE">Storage</option><option value="QUARANTINE">Quarantine</option><option value="REMOVED">Remove from active collection</option></Select>
      <Select name="toAquariumId" defaultValue=""><option value="">Destination aquarium, if applicable</option>{compatibleAquariums.map((entry: any) => <option key={entry.id} value={entry.id}>{entry.generatedName ?? entry.name} · {entry.salinity.toLowerCase()}</option>)}</Select>
      {selected?.speciesDefinition ? <p className="text-xs text-muted-foreground">Aquarium destinations are filtered to match the selected species’ salinity range.</p> : null}
      <Select name="toStorageLocationId" defaultValue=""><option value="">Storage location, if applicable</option>{storageLocations.map((entry: any) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select>
      <Select name="toQuarantineProjectId" defaultValue=""><option value="">Quarantine project, if applicable</option>{quarantineProjects.map((entry: any) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select>
      <Input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" />
      <Input name="reason" placeholder="Reason for move" />
      <Button type="submit" variant="secondary">Move inhabitant</Button>
    </form>
  );
}
