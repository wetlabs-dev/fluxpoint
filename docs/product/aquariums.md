# Aquariums

Aquariums store a target salinity range in parts per thousand rather than using a single habitat choice as operational truth. Existing freshwater, brackish, and marine tanks migrate to 0–0.5, 0.5–30, and 30–40 ppt respectively. Fluxpoint derives compact habitat badges from every band the target intersects, so a broad range may display more than one badge.

Tank type remains independent from salinity. Display, quarantine, hospital, pond, breeding, grow-out, frag, holding, and other continue to describe the aquarium’s purpose.

Species placement compares the aquarium target range directly with the species salinity range. Aquarium cards, filters, detail pages, inventory placement, transfers, tank labels, and livestock sheets use that derived range. The legacy salinity enum remains synchronized only for backward-compatible display and integrations.

Saving the target water profile recalculates its derived metric thresholds. The update is recorded as one aquarium-level audit event rather than one noisy event per metric row.
