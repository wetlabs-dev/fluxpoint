import { format } from "date-fns";
import { Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmSubmitButton } from "@/components/media/ConfirmSubmitButton";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import { MediaModerationBadge } from "@/components/media/MediaModerationBadge";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import type { MediaAssetView } from "@/components/media/media-types";
import { askEddyAboutPhoto, hideMediaAsset, removeMediaAsset, setAquariumCoverPhoto, updateMediaAssetMetadata } from "@/domains/media/actions";

type Option = { id: string; label: string };

function tagList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function MediaGrid({ assets, coverMediaAssetId, speciesOptions = [] }: { assets: MediaAssetView[]; coverMediaAssetId?: string | null; speciesOptions?: Option[] }) {
  if (!assets.length) return <div className="rounded-md border border-dashed border-border p-7 text-center text-sm text-muted-foreground">No aquarium photos yet. Upload photos to start building this tank’s visual history.</div>;
  const approvedAssets = assets.filter((asset) => asset.moderationStatus === "APPROVED" && !asset.hiddenAt);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset) => {
        const isCover = coverMediaAssetId === asset.id;
        const caption = asset.caption || asset.item?.name || asset.aquariumEvent?.title || "Aquarium photo";
        return (
          <article key={asset.id} className="group overflow-hidden rounded-xl border border-border bg-background/60 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_55px_-34px_rgb(9_46_53_/_0.7)]">
            <div className="relative">
              <MediaThumbnail asset={asset} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-slate-950/80 to-transparent p-3 text-white opacity-0 transition group-hover:opacity-100">
                {isCover ? <span className="rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-slate-950">Cover</span> : null}
                {asset.mediaSource === "AI_GENERATED" ? <span className="rounded-full bg-cyan-300/90 px-2 py-1 text-xs font-bold text-slate-950">Eddy-generated</span> : null}
              </div>
            </div>
            <div className="space-y-3 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <MediaModerationBadge status={asset.moderationStatus} hidden={Boolean(asset.hiddenAt)} />
                <span className="font-mono text-xs text-muted-foreground">{format(asset.captureDate ?? asset.createdAt, "MMM d, yyyy")}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">{caption}</p>
                {asset.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{asset.description}</p> : null}
                {asset.item ? <p className="text-xs text-muted-foreground">{asset.item.name} · {asset.item.itemType.toLowerCase()}</p> : null}
                {asset.aquariumEvent ? <p className="text-xs text-muted-foreground">Timeline: {asset.aquariumEvent.title}</p> : null}
              </div>
              {tagList(asset.tags).length ? <div className="flex flex-wrap gap-1">{tagList(asset.tags).slice(0, 4).map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">{tag}</span>)}</div> : null}
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <MediaLightbox assets={approvedAssets} initialId={asset.id} />
                {asset.moderationStatus === "APPROVED" && !asset.hiddenAt ? <form action={askEddyAboutPhoto}><input type="hidden" name="id" value={asset.id} /><button className="inline-flex items-center text-primary underline" type="submit"><Sparkles className="mr-1 h-3.5 w-3.5" />Ask Eddy</button></form> : null}
              </div>
              <details className="rounded-md border border-border bg-muted/30 p-3">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Edit metadata</summary>
                <form action={updateMediaAssetMetadata} className="mt-3 grid gap-2">
                  <input type="hidden" name="id" value={asset.id} />
                  <Input name="caption" placeholder="Caption" defaultValue={asset.caption ?? ""} />
                  <Textarea name="description" placeholder="Description" defaultValue={asset.description ?? ""} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input name="photographer" placeholder="Photographer" defaultValue={asset.photographer ?? ""} />
                    <Input name="captureDate" type="date" defaultValue={asset.captureDate ? format(asset.captureDate, "yyyy-MM-dd") : ""} />
                  </div>
                  <Input name="altText" placeholder="Alt text" defaultValue={asset.altText ?? ""} />
                  <Input name="tags" placeholder="Tags, comma-separated" defaultValue={tagList(asset.tags).join(", ")} />
                  {speciesOptions.length ? (
                    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                      Species shown
                      <Select name="speciesDefinitionId" multiple defaultValue={(asset.speciesLinks ?? []).map((link) => link.speciesDefinition.id)} className="min-h-24">
                        {speciesOptions.map((species) => <option key={species.id} value={species.id}>{species.label}</option>)}
                      </Select>
                    </label>
                  ) : null}
                  <Button type="submit" variant="secondary">Save metadata</Button>
                </form>
              </details>
              <div className="flex flex-wrap gap-2">
                {asset.moderationStatus === "APPROVED" && !asset.hiddenAt ? (
                  <form action={setAquariumCoverPhoto}><input type="hidden" name="id" value={asset.id} /><Button type="submit" variant="secondary" disabled={isCover}><Camera className="mr-2 h-4 w-4" />{isCover ? "Cover" : "Set cover"}</Button></form>
                ) : null}
                <form action={hideMediaAsset}><input type="hidden" name="id" value={asset.id} /><Button type="submit" variant="secondary">{asset.hiddenAt ? "Restore" : "Hide"}</Button></form>
                <form action={removeMediaAsset}><input type="hidden" name="id" value={asset.id} /><ConfirmSubmitButton message={isCover ? "Delete this cover photo? Fluxpoint will automatically choose the newest approved visible photo as the next cover when possible." : "Delete this photo permanently?"}>Delete</ConfirmSubmitButton></form>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
