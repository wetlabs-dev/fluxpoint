import { Input } from "@/components/ui/input";
import { EddyButton } from "@/components/eddy/EddyButton";

export function EddyCompatibilityForm({ onRun, loading }: { onRun: (input: Record<string, unknown>) => void; loading: boolean }) {
  return <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_auto]" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onRun({ proposal: data.get("proposal"), quantity: Number(data.get("quantity")) || null }); }}><Input name="proposal" required placeholder="Species or stocking idea" /><Input name="quantity" type="number" min="1" placeholder="Qty" /><EddyButton type="submit" variant="secondary" disabled={loading}>Check fit</EddyButton></form>;
}
