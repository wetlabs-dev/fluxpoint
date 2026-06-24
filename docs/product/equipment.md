# Equipment

Equipment records are durable inventory items that can be attached to one or more aquarium profiles by role. A light must be attached with the Light role before it can receive an aquarium lighting schedule.

Light equipment supports a capability profile, rated maximum lumens, wattage, and optional efficacy in lumens per watt. Rated lumens are preferred. When only wattage is known, Fluxpoint derives a lower-confidence lumen estimate from the supplied efficacy or a conservative capability-based default. The saved output method is `LUMENS`, `WATTAGE_ESTIMATED`, or `UNKNOWN`; it is recalculated whenever the equipment record is saved.

Each aquarium/light pair has its own schedule assignment, enabled state, and notes. This allows two fixtures over the same aquarium to run different schedules. Equipment detail shows each aquarium assignment separately. Removing or disabling one assignment affects only that light's contribution to the aquarium total.

Estimated lumen-hours are a comparison aid, not PAR and not a claim about light reaching livestock, plants, coral, or substrate.
