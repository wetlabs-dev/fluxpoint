# QR codes and printable labels

Each tank, inventory item, equipment record, or species definition can have one stable random public code. The QR contains an HTTPS URL such as `/q/inventory/<publicCode>` and never exposes a database ID. Renaming a record does not change its code.

Scan routes require authentication. Signed-out users return to the scan after login; users outside the owning collection receive an access-denied page. Scans are intentionally not audit-logged because routine scanning would create high-volume noise. Stable-code creation, label generation, livestock sheet generation, and label deletion are audited.

Available PDFs are:

- 2-inch simple QR label
- inventory detail label
- equipment detail label
- tank detail label
- letter-size aquarium livestock sheet

Generated files live under `public/labels/<collectionId>` for existing backup compatibility, but middleware blocks direct HTTP access. Downloads use the authenticated `/api/labels/[id]` route with private, no-store headers. Viewer roles may download; Fishkeeper and higher may generate; Collection Owners and Server Admins may delete through the API.

The standard sitewide backup already includes `public/labels`. If a database record exists but its file is missing, the download API returns 404 rather than exposing a filesystem path.

V1 uses a 2-by-2-inch simple QR page, a 5-by-2.5-inch detail page, and US Letter livestock sheets. Print individual labels at 100% / actual size. Brother-specific rolls, 0.5-inch and 1-inch templates, A4 sheets, PNG previews, and direct printer integrations are intentionally future extensions; the renderer and label-type model keep those additions isolated.
