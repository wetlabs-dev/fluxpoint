import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import { MediaModerationBadge } from "@/components/media/MediaModerationBadge";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import type { MediaAssetView } from "@/components/media/media-types";
import { hideMediaAsset, removeMediaAsset, setAquariumCoverPhoto } from "@/domains/media/actions";

export function MediaGrid({ assets, coverMediaAssetId }: { assets: MediaAssetView[]; coverMediaAssetId?: string | null }) {
  if (!assets.length) return <div className="rounded-md border border-dashed border-border p-7 text-center text-sm text-muted-foreground">No aquarium photos yet.</div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset) => (
        <article key={asset.id} className="overflow-hidden rounded-lg border border-border bg-background/60">
          <MediaThumbnail asset={asset} />
          <div className="space-y-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <MediaModerationBadge status={asset.moderationStatus} hidden={Boolean(asset.hiddenAt)} />
              <span className="font-mono text-xs text-muted-foreground">{format(asset.createdAt, "MMM d, yyyy")}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">{asset.caption || asset.item?.name || asset.aquariumEvent?.title || "Aquarium photo"}</p>
              {asset.item ? <p className="text-xs text-muted-foreground">{asset.item.name} · {asset.item.itemType.toLowerCase()}</p> : null}
              {asset.aquariumEvent ? <p className="text-xs text-muted-foreground">Timeline: {asset.aquariumEvent.title}</p> : null}
            </div>
            <MediaLightbox asset={asset} />
            <div className="flex flex-wrap gap-2">
              {asset.moderationStatus === "APPROVED" && !asset.hiddenAt ? (
                <form action={setAquariumCoverPhoto}><input type="hidden" name="id" value={asset.id} /><Button type="submit" variant="secondary" disabled={coverMediaAssetId === asset.id}>{coverMediaAssetId === asset.id ? "Cover" : "Set cover"}</Button></form>
              ) : null}
              <form action={hideMediaAsset}><input type="hidden" name="id" value={asset.id} /><Button type="submit" variant="secondary">{asset.hiddenAt ? "Restore" : "Hide"}</Button></form>
              <form action={removeMediaAsset}><input type="hidden" name="id" value={asset.id} /><Button type="submit" variant="secondary">Remove</Button></form>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
