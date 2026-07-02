"use client";

import { useMemo, useState } from "react";
import { attachEquipmentToAquarium, duplicateEquipment } from "@/domains/management/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type EquipmentOption = {
  id: string;
  name: string;
  label: string;
  equipmentType: string | null;
  multiAquariumCapable: boolean;
  attachedAquariums: { id: string; name: string }[];
};

export function AquariumEquipmentAttachForm({
  aquariumId,
  roles,
  equipment,
  duplicateSources
}: {
  aquariumId: string;
  roles: { value: string; label: string }[];
  equipment: EquipmentOption[];
  duplicateSources: EquipmentOption[];
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = useMemo(() => equipment.find((item) => item.id === selectedId) ?? null, [equipment, selectedId]);
  const attachedElsewhere = selected?.attachedAquariums.filter((aquarium) => aquarium.id !== aquariumId) ?? [];
  const needsConfirmation = Boolean(selected && attachedElsewhere.length && !selected.multiAquariumCapable);
  const notice = attachedElsewhere.length ? attachedElsewhere.map((aquarium) => aquarium.name).join(", ") : "";

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <form action={attachEquipmentToAquarium} className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input type="hidden" name="aquariumId" value={aquariumId} />
        <Select name="role" defaultValue="OTHER">{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</Select>
        <Select name="itemId" required value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="">Choose owned item</option>
          {equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </Select>
        <Input name="notes" placeholder="Optional role notes" />
        <Button type="submit" disabled={!equipment.length}>Attach</Button>
        {selected && attachedElsewhere.length ? (
          <div className={`rounded-md border p-3 text-sm sm:col-span-4 ${selected.multiAquariumCapable ? "border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/35 dark:text-cyan-100" : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100"}`}>
            {selected.multiAquariumCapable
              ? `This shared equipment is already assigned to: ${notice}. It can be attached to multiple aquariums.`
              : `This equipment is already assigned to: ${notice}. Most equipment should only be attached to one aquarium. Assign it here too?`}
            {needsConfirmation ? <label className="mt-2 flex items-center gap-2 font-semibold"><input type="checkbox" name="multiAssignmentConfirmed" required /> Confirm multi-aquarium assignment</label> : null}
          </div>
        ) : null}
      </form>
      <details className="rounded-md border border-border bg-background/45 p-3">
        <summary className="cursor-pointer font-semibold text-primary">Duplicate existing equipment and attach it here</summary>
        <form action={duplicateEquipment} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
          <input type="hidden" name="attachAquariumId" value={aquariumId} />
          <Select name="itemId" required defaultValue="">
            <option value="">Choose equipment to copy</option>
            {duplicateSources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </Select>
          <Select name="role" defaultValue="OTHER">{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</Select>
          <Button type="submit">Duplicate & attach</Button>
        </form>
      </details>
      {!equipment.length ? <p className="text-xs text-muted-foreground">All eligible equipment and substrate inventory is already attached to this aquarium.</p> : null}
    </div>
  );
}
