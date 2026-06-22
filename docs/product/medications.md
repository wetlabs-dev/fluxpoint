# Medications and conditions

Medication definitions and courses remain label-driven planning records. A disease- or parasite-category condition may link to a medication course in the same aquarium. The condition detail shows the product, course status, and recorded dose-event count; medication events remain in the aquarium timeline.

Linking a course stores both a direct condition relation and a generic `TREATED_BY` link, writes a condition timeline event, and records an audit entry. It may move an `ACTIVE` condition to `TREATING`. Fluxpoint never resolves a condition automatically when a course ends: the keeper records an observation and chooses improving, watching, resolved, or another status.

Always verify the product label. Fluxpoint does not diagnose disease, prescribe a product, or alter user-entered dose instructions.
