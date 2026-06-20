import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import type { MediaAssetView } from "@/components/media/media-types";

export function AquariumPhotoStrip({ assets }: { assets: MediaAssetView[] }) {
  const approved = assets.filter((asset) => asset.moderationStatus === "APPROVED" && !asset.hiddenAt).slice(0, 5);
  if (!approved.length) return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Approved photos will appear here after review.</p>;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{approved.map((asset) => <MediaThumbnail key={asset.id} asset={asset} className="aspect-square w-full" />)}</div>;
}
