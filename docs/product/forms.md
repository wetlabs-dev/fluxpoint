# Form Interaction Pattern

Primary create forms appear in wide, collapsed-by-default cards above their result lists. Opening the panel reveals the full responsive form; intent-bearing links may open it automatically when they already specify a record type or destination. Responsive grids use multiple columns only when fields remain readable; mobile layouts stack without a right-side create rail. Create and edit forms should share section ordering, visible labels, helper text, validation, and button language.

Long forms group fields into identity, configuration, advanced metadata, and notes sections. Placeholders are examples, not labels. Textareas and AI review panels receive full-row space.

Successful server-action forms set a short-lived Fluxpoint form notice. The authenticated app shell displays the notice as a transient, dismissible toast and removes it automatically. Create messages should name the record when practical; updates use “Saved”; destructive actions use “Deleted,” “Archived,” or “Removed.” Server validation errors remain distinct and must never be converted into success notices.

Create forms use an object-centered submit pattern:

- The primary `Create ...` action creates the record, sets a success notice, and navigates to the new record workspace/detail page when one exists.
- The secondary `Create & Add Another` action creates the record, sets a success notice, and redirects to a fresh create form for bulk entry.
- List-only records that do not have a detail workspace return to their list after creation, while `Create & Add Another` opens a fresh create panel.
- Edit forms do not expose `Create & Add Another`; they continue to use save-in-place behavior.

Create submit buttons use the shared submit intent names from `src/lib/forms/create-flow-constants.ts`. Server actions should route through `finishCreateFlow` when there is a canonical detail URL, or explicitly branch on `wantsCreateAndAddAnother` for list-only records. Redirecting for the add-another path is intentional: it guarantees stale client state, Magic Fill drafts, file inputs, aliases, and optimistic form data are cleared before the next entry begins.

Client-side AI helpers show their own immediate draft state. Applying an Eddy draft confirms: “Draft applied. Review and save to keep changes.” Applying a draft does not imply persistence; the normal form still must be submitted.
