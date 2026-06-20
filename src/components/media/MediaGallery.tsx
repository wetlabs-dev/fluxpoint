import { MediaGrid } from "@/components/media/MediaGrid";
import type { MediaAssetView } from "@/components/media/media-types";

export function MediaGallery(props: { assets: MediaAssetView[]; coverMediaAssetId?: string | null }) {
  return <MediaGrid {...props} />;
}
