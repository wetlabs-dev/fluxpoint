"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Download, X } from "lucide-react";
import type { MediaAssetView } from "@/components/media/media-types";
import { mediaDeliveryUrl } from "@/domains/media/media-urls";

function visibleAssets(assets: MediaAssetView[]) {
  return assets.filter((asset) => asset.moderationStatus === "APPROVED" && !asset.hiddenAt);
}

function fileSize(bytes?: number | null) {
  if (!bytes) return null;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function tags(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function MediaLightbox({ assets, initialId, triggerLabel = "View full photo" }: { assets: MediaAssetView[]; initialId: string; triggerLabel?: string }) {
  const galleryAssets = useMemo(() => visibleAssets(assets), [assets]);
  const initialIndex = Math.max(0, galleryAssets.findIndex((asset) => asset.id === initialId));
  const [index, setIndex] = useState(initialIndex);
  const [open, setOpen] = useState(false);
  const asset = galleryAssets[index];

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowLeft") setIndex((current) => (current + galleryAssets.length - 1) % galleryAssets.length);
      if (event.key === "ArrowRight") setIndex((current) => (current + 1) % galleryAssets.length);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [galleryAssets.length, open]);

  if (!galleryAssets.length || !asset) return null;

  const species = [
    asset.speciesDefinition ? { id: asset.speciesDefinition.id, label: asset.speciesDefinition.commonName || asset.speciesDefinition.scientificName || "Species" } : null,
    ...(asset.speciesLinks ?? []).map((link) => ({ id: link.speciesDefinition.id, label: [link.speciesDefinition.commonName, link.speciesVariant?.displayName || link.speciesVariant?.name].filter(Boolean).join(" · ") || link.speciesDefinition.scientificName || "Species" }))
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  return (
    <>
      <button type="button" onClick={() => { setIndex(initialIndex); setOpen(true); }} className="cursor-zoom-in text-xs font-semibold text-primary underline">{triggerLabel}</button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Aquarium photo viewer" className="fixed inset-0 z-50 bg-slate-950/95 text-white">
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
            <div className="relative grid min-h-0 place-items-center p-4 lg:p-8">
              <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-slate-950 shadow-lg"><X className="h-5 w-5" /></button>
              {galleryAssets.length > 1 ? (
                <>
                  <button type="button" onClick={() => setIndex((current) => (current + galleryAssets.length - 1) % galleryAssets.length)} className="absolute left-4 top-1/2 z-10 rounded-full bg-white/85 p-2 text-slate-950 shadow-lg"><ArrowLeft className="h-5 w-5" /></button>
                  <button type="button" onClick={() => setIndex((current) => (current + 1) % galleryAssets.length)} className="absolute right-4 top-1/2 z-10 rounded-full bg-white/85 p-2 text-slate-950 shadow-lg lg:right-[380px]"><ArrowRight className="h-5 w-5" /></button>
                </>
              ) : null}
              <img src={mediaDeliveryUrl(asset.url, asset.id)} alt={asset.altText || asset.caption || "Aquarium photo"} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
            </div>
            <aside className="min-h-0 overflow-auto border-t border-white/15 bg-slate-900 p-5 lg:border-l lg:border-t-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{index + 1} of {galleryAssets.length}</div>
              <h2 className="mt-2 font-display text-3xl">{asset.caption || asset.item?.name || asset.aquariumEvent?.title || "Aquarium photo"}</h2>
              {asset.description ? <p className="mt-3 text-sm leading-6 text-slate-200">{asset.description}</p> : null}
              <dl className="mt-5 grid gap-3 text-sm">
                <Info label="Captured" value={asset.captureDate ? format(asset.captureDate, "MMM d, yyyy") : null} />
                <Info label="Uploaded" value={asset.createdAt ? format(asset.createdAt, "MMM d, yyyy") : null} />
                <Info label="Photographer" value={asset.photographer || asset.uploadedBy?.name || asset.uploadedBy?.email} />
                <Info label="Attached item" value={asset.item ? `${asset.item.name} · ${asset.item.itemType.toLowerCase()}` : null} />
                <Info label="Timeline" value={asset.aquariumEvent ? `${format(asset.aquariumEvent.eventDate, "MMM d")} · ${asset.aquariumEvent.title}` : null} />
                <Info label="Image" value={[asset.width && asset.height ? `${asset.width}×${asset.height}` : null, fileSize(asset.sizeBytes)].filter(Boolean).join(" · ")} />
                <Info label="Source" value={asset.mediaSource?.replaceAll("_", " ").toLowerCase()} />
              </dl>
              {species.length ? <div className="mt-5"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Species shown</div><div className="mt-2 flex flex-wrap gap-2">{species.map((entry) => <span key={entry.id} className="rounded-full border border-cyan-200/25 px-3 py-1 text-xs font-semibold text-cyan-100">{entry.label}</span>)}</div></div> : null}
              {tags(asset.tags).length ? <div className="mt-5"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tags</div><div className="mt-2 flex flex-wrap gap-2">{tags(asset.tags).map((tag) => <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs">{tag}</span>)}</div></div> : null}
              <a href={mediaDeliveryUrl(asset.url, asset.id)} download className="mt-6 inline-flex min-h-10 items-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950"><Download className="mr-2 h-4 w-4" />Download original</a>
            </aside>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <div><dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</dt><dd className="mt-1 text-slate-100">{value}</dd></div>;
}
