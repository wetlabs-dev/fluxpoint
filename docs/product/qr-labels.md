# QR codes and printable labels

Each tank, inventory item, equipment record, or species definition can have one stable random public code. The QR encodes a normal web URL such as `https://fluxpoint.example/q/inventory/<publicCode>` and never exposes a database ID. Renaming a record does not change its code, and older QR rows are refreshed to web URLs the next time their code is ensured.

Scan routes require authentication. Signed-out users return to the scan after login; users outside the owning collection receive an access-denied page. Scans are intentionally not audit-logged because routine scanning would create high-volume noise. Stable-code creation, individual label generation, bulk label generation, livestock sheet generation, and label deletion are audited.

Available PDFs are:

- 2-inch simple QR label
- inventory detail label
- equipment detail label
- tank detail label
- letter-size aquarium livestock sheet
- bulk batches of simple, inventory/species detail, equipment detail, or tank detail labels

Simple and detail labels print only the QR image and keeper-facing context. They do not print the stable public code below the QR. Full labels use concise useful context: inventory and species labels show names, scientific names when available, quantity or placement, and exceptional statuses; equipment labels show type, placement, brand/model, and maintenance interval when recorded; tank labels show volume, location, and exceptional status. Routine values such as `active`, empty maintenance dates, or internal codes are intentionally omitted.

The global **Labels** page supports batch generation. Keepers can filter by tank, storage location, item type, status, species category, equipment type, equipment role, and text search, then manually deselect individual rows before generating a PDF. Bulk batches are limited to practical page counts and preserve each record's existing stable QR where possible.

Generated files live under `public/labels/<collectionId>` for existing backup compatibility, but middleware blocks direct HTTP access. Downloads use the authenticated `/api/labels/[id]` route with private, no-store headers. The API serves PDFs inline by default for browser printing and as an attachment when `?download=1` is supplied. Viewer roles may download; Fishkeeper and higher may generate; Collection Owners and Server Admins may delete through the API.

The standard sitewide backup already includes `public/labels`. If a database record exists but its file is missing, the download API returns 404 rather than exposing a filesystem path.

V1 uses a 2-by-2-inch simple QR page, a 5-by-2.5-inch detail page, and US Letter livestock sheets. Print individual labels at 100% / actual size. Installed PWAs may not always expose full browser print controls for inline PDFs; use **Open / Print** in a browser tab, or **Download** and share/open the PDF from the system viewer. Brother-specific rolls, 0.5-inch and 1-inch templates, A4 sheets, PNG previews, and direct printer integrations are intentionally future extensions; the renderer and label-type model keep those additions isolated.
