import { Input } from "@/components/ui/input";
import { EddyButton } from "@/components/eddy/EddyButton";

export function EddyStockingForm({ onRun, loading }: { onRun: (input: Record<string, unknown>) => void; loading: boolean }) {
  return <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); onRun({ goal: new FormData(event.currentTarget).get("goal") }); }}><Input name="goal" required placeholder="Goal: color, schooling, algae control, centerpiece…" /><EddyButton type="submit" variant="secondary" disabled={loading}>Find ideas</EddyButton></form>;
}
