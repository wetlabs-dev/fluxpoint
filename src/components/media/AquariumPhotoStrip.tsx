import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import type { MediaAssetView } from "@/components/media/media-types";

export function AquariumPhotoStrip({ assets }: { assets: MediaAssetView[] }) {
  const approved = assets.filter((asset) => asset.moderationStatus === "APPROVED" && !asset.hiddenAt).slice(0, 8);
  if (!approved.length) return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Approved photos will appear here after review.</p>;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{approved.map((asset) => <div key={asset.id} className="group relative overflow-hidden rounded-lg"><MediaThumbnail asset={asset} className="aspect-square w-full" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent p-2 text-white opacity-0 transition group-hover:opacity-100"><MediaLightbox assets={approved} initialId={asset.id} triggerLabel="Open" /></div></div>)}</div>;
}
