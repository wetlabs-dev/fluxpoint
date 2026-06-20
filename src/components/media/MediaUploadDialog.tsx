"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type Option = { id: string; label: string };

export function MediaUploadDialog({ aquariumId, items = [], events = [], defaultItemId }: { aquariumId: string; items?: Option[]; events?: Option[]; defaultItemId?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/media/upload", { method: "POST", body: new FormData(form) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "Photo upload failed.");
    setMessage(result.message || "Photo uploaded.");
    form.reset();
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={() => dialogRef.current?.showModal()}><ImagePlus className="mr-2 h-4 w-4" />Upload photo</Button>
      <dialog ref={dialogRef} className="w-[min(94vw,560px)] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-slate-950/65">
        <form onSubmit={submit} className="grid gap-4 p-5">
          <input type="hidden" name="aquariumId" value={aquariumId} />
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-2xl text-primary">Add aquarium photo</h2><p className="text-sm text-muted-foreground">Photos are reviewed before appearing in galleries.</p></div><Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>Close</Button></div>
          <label className="grid gap-1 text-sm font-medium"><span>Photo</span><Input type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
          <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP · up to 12 MB · HEIC is not currently accepted.</p>
          <label className="grid gap-1 text-sm font-medium"><span>Caption</span><Input name="caption" maxLength={500} placeholder="What is happening in this photo?" /></label>
          {items.length ? <label className="grid gap-1 text-sm font-medium"><span>Attach to inhabitant or equipment</span><Select name="itemId" defaultValue={defaultItemId || ""}><option value="">Aquarium only</option>{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label> : null}
          {events.length ? <label className="grid gap-1 text-sm font-medium"><span>Attach to timeline event</span><Select name="aquariumEventId" defaultValue=""><option value="">No existing event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}</Select></label> : null}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="createPhotoEvent" value="true" /> Create a new photo event on the timeline</label>
          {message ? <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p> : null}
          <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{busy ? "Uploading…" : "Upload for review"}</Button>
        </form>
      </dialog>
    </>
  );
}
