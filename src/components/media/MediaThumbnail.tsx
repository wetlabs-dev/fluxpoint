import { ImageIcon, ShieldAlert } from "lucide-react";
import type { MediaAssetView } from "@/components/media/media-types";
import { RetryingMediaImage } from "@/components/media/RetryingMediaImage";
import { mediaDeliveryUrl } from "@/domains/media/media-urls";

export function MediaThumbnail({ asset, className = "aspect-[4/3] w-full" }: { asset: MediaAssetView; className?: string }) {
  const displayable = asset.moderationStatus === "APPROVED" && !asset.hiddenAt;
  const unavailableLabel = asset.hiddenAt ? "Photo hidden"
    : asset.moderationStatus === "PENDING" ? "Review pending"
      : asset.moderationStatus === "NO_AQUARIUM_CONTENT" ? "Needs aquarium review"
        : asset.moderationStatus === "UNCERTAIN_AQUARIUM_CONTENT" ? "Aquarium review needed"
          : asset.moderationStatus === "MODERATION_FAILED" || asset.moderationStatus === "ERROR" ? "Review failed"
            : asset.moderationStatus === "CENSORED" ? "Safety review"
              : asset.moderationStatus === "REMOVED" ? "Photo removed"
                : "Photo unavailable";
  if (!displayable) {
    return (
      <div className={`${className} grid place-items-center rounded-md bg-muted p-4 text-center text-muted-foreground`}>
        <div className="space-y-2">
          {asset.moderationStatus === "PENDING" ? <ImageIcon className="mx-auto h-7 w-7" /> : <ShieldAlert className="mx-auto h-7 w-7" />}
          <p className="text-xs font-semibold">{unavailableLabel}</p>
        </div>
      </div>
    );
  }
  return <RetryingMediaImage className={`${className} rounded-md object-cover`} src={mediaDeliveryUrl(asset.thumbnailUrl || asset.url, asset.id)} alt={asset.altText || asset.caption || "Aquarium photo"} fallbackLabel="Photo unavailable" />;
}
