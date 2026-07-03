# Aquariums

Aquariums store a target salinity range in parts per thousand rather than using a single habitat choice as operational truth. Existing freshwater, brackish, and marine tanks migrate to 0–0.5, 0.5–30, and 30–40 ppt respectively. Fluxpoint derives compact habitat badges from every band the target intersects, so a broad range may display more than one badge.

Tank type remains independent from salinity. Display, quarantine, hospital, pond, breeding, grow-out, frag, holding, and other continue to describe the aquarium’s purpose.

Species placement compares the aquarium target range directly with the species salinity range. Aquarium cards, filters, detail pages, inventory placement, transfers, tank labels, and livestock sheets use that derived range. The legacy salinity enum remains synchronized only for backward-compatible display and integrations.

Aquarium list cards are content-sized and align to the top of their grid. Card subtitle copy uses an intentional generated mood when available, otherwise a short description or derived habitat/type summary. The old “new aquarium plan” placeholder is never rendered and is no longer written for newly created aquariums.

Saving the target water profile recalculates its derived metric thresholds. The update is recorded as one aquarium-level audit event rather than one noisy event per metric row.

Aquarium overview pages include a compact Stocking Pressure card. The estimate is requested explicitly and uses active aquarium inhabitants, quantities, linked species context, plants, tank volume, and attached filtration. Fluxpoint stores estimate history and only enables refresh after a relevant input changes. Plants count as modest nutrient support but never erase heavy animal pressure, and the result remains advisory rather than a stocking guarantee.

The aquarium inhabitants workspace writes through Inventory. Adding fish, invertebrates, plants, or coral/other from the tank page silently creates or updates `AquariumItem` records, records a livestock/plant timeline event, and keeps the Inventory detail/history page as the durable object record. Matching active groups increment when no distinct acquisition/source metadata needs to be preserved.

The aquarium equipment workspace attaches durable inventory items through `AquariumEquipmentAttachment`, grouped by role. It supports both normal one-tank equipment and shared systems. If an equipment item is already assigned to another aquarium and is not marked shared-capable, the keeper must explicitly confirm the extra assignment before Fluxpoint attaches it here. The same workspace can duplicate an existing equipment model and immediately attach the new copy to the current aquarium, which is useful for repeated filters, lights, heaters, or pumps.

Tank Audits are available from the aquarium quick actions. They snapshot the tank, generate a printable worksheet, and provide a finalize step that true-ups Inventory while recording aquarium timeline events. Tank Audits are operational inventory sessions, not the server/security Audit Log.

Collection owners can publish an aquarium to Public Browse from the aquarium Settings workspace. The public profile has its own title, subtitle, description, slug, and section toggles, plus explicit inventory-row selection for public inhabitants, plants, attached equipment, substrate, and hardscape. A preview route shows the public rendering with a banner before publication. When the public schedule section is enabled, public pages include lighting schedules with the same lighting graph used inside the app.

Aquarium workspaces also include a tank cost receipt. The receipt uses Inventory unit price multiplied by current quantity, groups costs by livestock, plants, equipment, substrate/hardscape, consumables, and other, and displays each group as a percentage of the tank total. This receipt is authenticated-only and is never included in public browse payloads.

## Additional tank contents

Aquarium detail pages include an **Additional tank contents** section for remembered context that should not yet become full Inventory. Rows are grouped by category: plant, fish, invertebrate, coral, hardscape, equipment, substrate, botanical, unknown, note, or other. Each row stores a free-text description, optional approximate quantity, confidence, intent, optional notes, and whether Eddy may use it as context.

These rows are intentionally separate from `AquariumItem`. They are useful for rough observations such as “unknown hitchhiker snail,” “large driftwood cave,” “floating plant clump,” or “temporary extra sponge filter.” Aquarists can add, edit, archive, or delete rows from the aquarium workspace. Rows marked **Needs structured record** are shown as follow-up work, but Fluxpoint does not automatically create Inventory from them or bypass species checks.

Eddy receives only rows where **Include this in Eddy context** is enabled. Eddy must treat them as non-inventory context: approximate plants can modestly inform plant-mass discussion, hardscape can inform territory and cover assumptions, and unknown fish/invertebrates increase uncertainty until converted into structured records.
