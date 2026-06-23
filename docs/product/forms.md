# Form Interaction Pattern

Primary create forms appear in wide cards above their result lists. Responsive grids use multiple columns only when fields remain readable; mobile layouts stack without a right-side create rail. Create and edit forms should share section ordering, visible labels, helper text, validation, and button language.

Long forms group fields into identity, configuration, advanced metadata, and notes sections. Placeholders are examples, not labels. Textareas and AI review panels receive full-row space.

Successful server-action forms set a short-lived Fluxpoint form notice. The authenticated app shell displays the notice as a transient, dismissible toast and removes it automatically. Create messages should name the record when practical; updates use “Saved”; destructive actions use “Deleted,” “Archived,” or “Removed.” Server validation errors remain distinct and must never be converted into success notices.

Client-side AI helpers show their own immediate draft state. Applying an Eddy draft confirms: “Draft applied. Review and save to keep changes.” Applying a draft does not imply persistence; the normal form still must be submitted.
