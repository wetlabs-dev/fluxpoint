import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { MediaGrid } from "@/components/media/MediaGrid";
import type { MediaAssetView } from "@/components/media/media-types";

type Option = { id: string; label: string };

export function MediaGallery({
  assets,
  coverMediaAssetId,
  aquariumId,
  speciesOptions = [],
  sort = "newest",
  filter = "all",
  species = ""
}: {
  assets: MediaAssetView[];
  coverMediaAssetId?: string | null;
  aquariumId?: string;
  speciesOptions?: Option[];
  sort?: string;
  filter?: string;
  species?: string;
}) {
  return (
    <div className="space-y-4">
      {aquariumId ? (
        <form action={`/aquariums/${aquariumId}#photos`} className="grid gap-3 rounded-xl border border-border bg-muted/25 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input type="hidden" name="workspace" value="photos" />
          <Select name="photoSort" defaultValue={sort} aria-label="Sort photos">
            <option value="newest">Newest by photo date</option>
            <option value="oldest">Oldest by photo date</option>
            <option value="capture-date">Captured date first</option>
            <option value="upload-date">Upload date first</option>
          </Select>
          <Select name="photoFilter" defaultValue={filter} aria-label="Filter photos">
            <option value="all">All photos</option>
            <option value="approved">Approved only</option>
            <option value="cover">Cover photo</option>
            <option value="event">Timeline/event photos</option>
            <option value="uploaded">Keeper uploads</option>
            <option value="ai">Eddy-generated</option>
          </Select>
          <Select name="photoSpecies" defaultValue={species} aria-label="Filter by species">
            <option value="">All species</option>
            {speciesOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
          <Button type="submit" variant="secondary">Update gallery</Button>
        </form>
      ) : null}
      <MediaGrid assets={assets} coverMediaAssetId={coverMediaAssetId} speciesOptions={speciesOptions} />
    </div>
  );
}
