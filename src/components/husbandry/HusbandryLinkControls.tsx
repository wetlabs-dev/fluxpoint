import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";

export function HusbandryLinkControls({
  speciesDefinitionId,
  guides,
  linkAction,
  forkAction,
  deleteAction,
  isLinked
}: {
  speciesDefinitionId: string;
  guides: { speciesDefinitionId: string; speciesDefinition: { commonName: string } }[];
  linkAction: (formData: FormData) => Promise<void>;
  forkAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  isLinked: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-muted/35 p-3">
      <form action={linkAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="speciesDefinitionId" value={speciesDefinitionId} />
        <Select name="sourceSpeciesDefinitionId" required>
          <option value="">Link to another species guide</option>
          {guides.filter((guide) => guide.speciesDefinitionId !== speciesDefinitionId).map((guide) => (
            <option key={guide.speciesDefinitionId} value={guide.speciesDefinitionId}>{guide.speciesDefinition.commonName}</option>
          ))}
        </Select>
        <Textarea name="sourceNotes" placeholder="Link notes" />
        <Button type="submit" variant="secondary">Link guide</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={forkAction}>
          <input type="hidden" name="speciesDefinitionId" value={speciesDefinitionId} />
          <Button type="submit" variant="secondary" disabled={!isLinked}>Fork linked guide</Button>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="speciesDefinitionId" value={speciesDefinitionId} />
          <Button type="submit" variant="secondary">Delete guide</Button>
        </form>
      </div>
    </div>
  );
}
