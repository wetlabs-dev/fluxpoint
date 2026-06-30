# Labels

Fluxpoint labels are authenticated PDFs generated from the same stable QR system described in [QR codes and printable labels](./qr-labels.md). The top-level **Labels** page is for batch work: filter records, review the selected rows, deselect anything that should not print, and generate one PDF for the selected tanks, inventory, equipment, or species records.

Supported batch filters include record family, tank, storage location, item type, lifecycle status, species category, equipment type, equipment attachment role, and text search. Rows are selected by default so a filtered result can be printed quickly, but the keeper still gets a manual checkbox review before generation.

QRs encode ordinary HTTPS application URLs and resolve through authenticated `/q/...` routes. The printed label does not show the public code as text. This keeps labels useful when scanned while avoiding unnecessary visible identifiers on aquariums, storage bins, or equipment.

Bulk label generation writes one audit event for the batch and stores the PDF as a durable `GeneratedLabel` record. Open the PDF inline for printing, or use the download action when an installed PWA or mobile browser does not expose print controls.
