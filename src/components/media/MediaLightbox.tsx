"use client";

import { useState } from "react";
import type { MediaAssetView } from "@/components/media/media-types";
import { mediaDeliveryUrl } from "@/domains/media/media-urls";

export function MediaLightbox({ asset }: { asset: MediaAssetView }) {
  const [open, setOpen] = useState(false);
  if (asset.moderationStatus !== "APPROVED" || asset.hiddenAt) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="cursor-zoom-in text-xs font-semibold text-primary underline">View full photo</button>
      {open ? <div role="dialog" aria-modal="true" aria-label="Aquarium photo" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/90 p-4">
        <button type="button" onClick={() => setOpen(false)} className="absolute right-5 top-5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-950">Close</button>
        <img src={mediaDeliveryUrl(asset.url, asset.id)} alt={asset.altText || asset.caption || "Aquarium photo"} className="max-h-[86vh] max-w-[92vw] rounded-lg object-contain" />
      </div> : null}
    </>
  );
}
