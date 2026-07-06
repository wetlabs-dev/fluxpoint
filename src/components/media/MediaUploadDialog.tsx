"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

type Option = { id: string; label: string };

export function MediaUploadDialog({
  aquariumId,
  items = [],
  events = [],
  speciesOptions = [],
  defaultItemId,
  conditionId
}: {
  aquariumId: string;
  items?: Option[];
  events?: Option[];
  speciesOptions?: Option[];
  defaultItemId?: string;
  conditionId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function setSelectedFiles(list: FileList | null) {
    setFiles(Array.from(list ?? []));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/media/upload", { method: "POST", body: new FormData(form) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "Photo upload failed.");
    setMessage(result.message || "Photos uploaded for review.");
    form.reset();
    setFiles([]);
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={() => dialogRef.current?.showModal()}><ImagePlus className="mr-2 h-4 w-4" />Upload photo</Button>
      <dialog ref={dialogRef} className="w-[min(94vw,720px)] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-slate-950/65">
        <form onSubmit={submit} className="grid gap-4 p-5">
          <input type="hidden" name="aquariumId" value={aquariumId} />
          {conditionId ? <input type="hidden" name="conditionId" value={conditionId} /> : null}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-primary">Add {conditionId ? "condition" : "aquarium"} photos</h2>
              <p className="text-sm text-muted-foreground">Upload several photos at once, attach context, and let moderation publish the safe ones.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>Close</Button>
          </div>

          <label
            className={`grid cursor-pointer place-items-center rounded-xl border border-dashed p-6 text-center transition ${dragging ? "border-water bg-water/10" : "border-border bg-muted/30 hover:bg-muted/55"}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (fileInputRef.current) {
                fileInputRef.current.files = event.dataTransfer.files;
                setSelectedFiles(event.dataTransfer.files);
              }
            }}
          >
            <UploadCloud className="mb-2 h-8 w-8 text-water" />
            <span className="font-semibold">Drop photos here or choose files</span>
            <span className="text-xs text-muted-foreground">JPEG, PNG, or WebP · up to 12 MB each · HEIC is not currently accepted</span>
            <input ref={fileInputRef} className="sr-only" type="file" name="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => setSelectedFiles(event.currentTarget.files)} />
          </label>

          {files.length ? (
            <div className="rounded-md bg-muted/45 p-3 text-sm">
              <div className="font-semibold">{files.length} file{files.length === 1 ? "" : "s"} selected · {(totalBytes / 1024 / 1024).toFixed(1)} MB</div>
              <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-xs text-muted-foreground">
                {files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium md:col-span-2"><span>Caption</span><Input name="caption" maxLength={500} placeholder="What is happening in these photos?" /></label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2"><span>Description</span><Textarea name="description" placeholder="Longer context, observations, or what changed." /></label>
            <label className="grid gap-1 text-sm font-medium"><span>Photographer</span><Input name="photographer" placeholder="Optional credit" /></label>
            <label className="grid gap-1 text-sm font-medium"><span>Captured at</span><Input name="captureDate" type="date" /></label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2"><span>Tags</span><Input name="tags" placeholder="plants, scape, feeding, maintenance" /></label>
          </div>

          {items.length ? <label className="grid gap-1 text-sm font-medium"><span>Attach to inhabitant, equipment, or content</span><Select name="itemId" defaultValue={defaultItemId || ""}><option value="">Aquarium only</option>{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label> : null}
          {events.length ? <label className="grid gap-1 text-sm font-medium"><span>Attach to timeline event</span><Select name="aquariumEventId" defaultValue=""><option value="">Create/use photo event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}</Select></label> : null}
          {speciesOptions.length ? <label className="grid gap-1 text-sm font-medium"><span>Species shown</span><Select name="speciesDefinitionId" multiple className="min-h-28">{speciesOptions.map((species) => <option key={species.id} value={species.id}>{species.label}</option>)}</Select><span className="text-xs text-muted-foreground">Hold Command/Ctrl to select multiple species.</span></label> : null}

          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="createPhotoEvent" value="false" />
            <input type="checkbox" name="createPhotoEvent" value="true" defaultChecked />
            Create a new photo event on the timeline
          </label>
          {message ? <p role="status" className="rounded-md bg-muted p-3 text-sm">{message} <a className="font-semibold text-primary underline" href={`/aquariums/${aquariumId}?workspace=photos#photos`}>View gallery</a></p> : null}
          <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{busy ? "Uploading…" : "Upload for review"}</Button>
        </form>
      </dialog>
    </>
  );
}
