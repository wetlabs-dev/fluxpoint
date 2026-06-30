# PWA printing notes

Fluxpoint's PWA shell is push-first in v1. It registers the service worker, manifest, icons, notification plumbing, and account notification settings without adding offline page caching.

Generated PDFs, including QR labels and bulk label batches, are still served by authenticated application routes. The normal path opens `/api/labels/[id]` inline so desktop browsers can print directly. The same route accepts `?download=1` to force a file download.

Installed PWAs and some mobile browsers can hide or simplify PDF print controls. When that happens, use the label action's **Download** button, share the file to the system PDF viewer, or open the inline PDF in a full browser tab before printing. Push notifications and installation are optional and are not required for label generation or PDF download.
