# Aquariums

Aquariums store a target salinity range in parts per thousand rather than using a single habitat choice as operational truth. Existing freshwater, brackish, and marine tanks migrate to 0–0.5, 0.5–30, and 30–40 ppt respectively. Fluxpoint derives compact habitat badges from every band the target intersects, so a broad range may display more than one badge.

Tank type remains independent from salinity. Display, quarantine, hospital, pond, breeding, grow-out, frag, holding, and other continue to describe the aquarium’s purpose.

Species placement compares the aquarium target range directly with the species salinity range. Aquarium cards, filters, detail pages, inventory placement, transfers, tank labels, and livestock sheets use that derived range. The legacy salinity enum remains synchronized only for backward-compatible display and integrations.

Aquarium list cards are content-sized and align to the top of their grid. Card subtitle copy uses an intentional generated mood when available, otherwise a short description or derived habitat/type summary. The old “new aquarium plan” placeholder is never rendered and is no longer written for newly created aquariums.

Saving the target water profile recalculates its derived metric thresholds. The update is recorded as one aquarium-level audit event rather than one noisy event per metric row.

Aquarium overview pages include a compact Stocking Pressure card. The estimate is requested explicitly and uses active aquarium inhabitants, quantities, linked species context, plants, tank volume, and attached filtration. Fluxpoint stores estimate history and only enables refresh after a relevant input changes. Plants count as modest nutrient support but never erase heavy animal pressure, and the result remains advisory rather than a stocking guarantee.

The aquarium inhabitants workspace writes through Inventory. Adding fish, invertebrates, plants, or coral/other from the tank page silently creates or updates `AquariumItem` records, records a livestock/plant timeline event, and keeps the Inventory detail/history page as the durable object record. Matching active groups increment when no distinct acquisition/source metadata needs to be preserved.

Tank Audits are available from the aquarium quick actions. They snapshot the tank, generate a printable worksheet, and provide a finalize step that true-ups Inventory while recording aquarium timeline events. Tank Audits are operational inventory sessions, not the server/security Audit Log.
