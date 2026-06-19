import { EddyIcon } from "@/components/eddy/EddyIcon";

export function HusbandryEmptyPrompt() {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/35 p-4 text-sm text-muted-foreground">
      <div className="mb-1 flex items-center gap-2 font-semibold text-primary">
        <EddyIcon size={16} className="h-4 w-4" />
        Add husbandry guide
      </div>
      <p>Start manually, use Magic Fill draft, or link to another same-collection species guide.</p>
    </div>
  );
}
