# Equipment

Equipment records are durable inventory items that can be attached to one or more aquarium profiles by role. A light must be attached with the Light role before it can receive an aquarium lighting schedule.

Equipment can be duplicated when a keeper buys another copy of the same model. Duplication copies stable profile details such as equipment type, brand, model, light capability/output estimates, maintenance cadence, and equipment notes. It intentionally does not copy serial numbers, QR/public codes, photos, last-maintained dates, condition history, attachment history, or active aquarium assignments. The new record receives its own QR code and starts with a “Copy of …” name for review.

Some equipment can intentionally serve more than one aquarium. The `Can serve multiple aquariums` flag is designed for shared systems such as air pumps, CO₂, controllers, dosers, monitoring equipment, or other central gear. Shared-capable equipment can be attached to additional aquariums with a soft notice. Non-shared equipment already attached elsewhere requires explicit confirmation before Fluxpoint creates another aquarium attachment, and multi-assigned non-shared records show a warning badge until the keeper either detaches the extra assignment or marks the item shared-capable.

Light equipment supports a capability profile, rated maximum lumens, wattage, and optional efficacy in lumens per watt. Rated lumens are preferred. When only wattage is known, Fluxpoint derives a lower-confidence lumen estimate from the supplied efficacy or a conservative capability-based default. The saved output method is `LUMENS`, `WATTAGE_ESTIMATED`, or `UNKNOWN`; it is recalculated whenever the equipment record is saved.

Each aquarium/light pair has its own schedule assignment, enabled state, and notes. This allows two fixtures over the same aquarium to run different schedules. Equipment detail shows each aquarium assignment separately. Removing or disabling one assignment affects only that light's contribution to the aquarium total.

Equipment detail and the equipment list show current aquarium assignments. A single attachment displays its aquarium and role; multiple attachments display as shared across the attached aquariums. QR labels for shared equipment prefer “Shared: Tank A, Tank B” when it fits, otherwise they fall back to “Shared equipment” for compact label formats.

Estimated lumen-hours are a comparison aid, not PAR and not a claim about light reaching livestock, plants, coral, or substrate.
