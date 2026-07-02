# Labels

Fluxpoint labels are authenticated PDFs generated from the same stable QR system described in [QR codes and printable labels](./qr-labels.md). The top-level **Labels** page is for batch work: filter records, review the selected rows, deselect anything that should not print, and generate one PDF for the selected tanks, inventory, equipment, or species records.

Supported batch filters include record family, tank, storage location, item type, lifecycle status, species category, equipment type, equipment attachment role, and text search. Rows are selected by default so a filtered result can be printed quickly, but the keeper still gets a manual checkbox review before generation.

QRs encode ordinary HTTPS application URLs and resolve through authenticated `/q/...` routes. The printed label does not show the public code as text. This keeps labels useful when scanned while avoiding unnecessary visible identifiers on aquariums, storage bins, or equipment.

When scanned anonymously, QR labels remain private by default. If Public Browse is enabled for the collection and the scanned aquarium or item has been published, the resolver sends anonymous visitors to the public aquarium page or a safe public item landing page. Logged-in authorized keepers still resolve to the authenticated workspace route.

Bulk label generation writes one audit event for the batch and stores the PDF as a durable `GeneratedLabel` record. Open the PDF inline for printing, or use the download action when an installed PWA or mobile browser does not expose print controls.

## Print formats

Fluxpoint supports the same full-label print formats as AxilDB, adapted for aquarium records:

- **2.25 x 1.25 inch label, one per page**: one compact label per PDF page.
- **Legacy print sheet, ganged labels**: multiple 2.25 x 1.25 labels placed on a letter-size sheet with cut spacing.
- **Brother DK-2210 continuous 1 1/7 inch label**: continuous tape labels using the DK-2210 tape width and dynamic label length.

Full labels support portrait and landscape orientation. The selected format and orientation are validated server-side against the registry; user-supplied dimensions are not accepted.

## QR-only square labels

QR-only labels remain available as a separate label type. They are always square, do not expose portrait/landscape controls, encode the same authenticated HTTPS `/q/...` web URL as full labels, and do not print the public code below the QR.

## Printable content rules

Full labels use high-contrast black-and-white PDF layouts. They prioritize a large QR code, large record name, category, placement, and a few concise metadata lines. Normal active status is omitted; exceptional statuses such as archived, consumed, dead, removed, or transferred may appear. Labels should not print placeholder copy such as “No maintenance date.”
