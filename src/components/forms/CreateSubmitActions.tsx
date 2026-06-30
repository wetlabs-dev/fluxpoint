import Link from "next/link";
import { createAndAddAnotherIntentValue, createIntentName, createIntentValue } from "@/lib/forms/create-flow-constants";
import { Button } from "@/components/ui/button";

export function CreateSubmitActions({ label, addAnotherLabel = "Create & Add Another", cancelHref, className = "", disabled = false }: { label: string; addAnotherLabel?: string; cancelHref?: string; className?: string; disabled?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${className}`}>
      <Button type="submit" name={createIntentName} value={createIntentValue} disabled={disabled}>{label}</Button>
      <Button type="submit" name={createIntentName} value={createAndAddAnotherIntentValue} variant="secondary" disabled={disabled}>{addAnotherLabel}</Button>
      {cancelHref ? <Link href={cancelHref} className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-primary hover:bg-muted">Cancel</Link> : null}
    </div>
  );
}
