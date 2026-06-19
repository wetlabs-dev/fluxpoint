import { Select } from "@/components/ui/input";
import { EddyButton } from "@/components/eddy/EddyButton";

export function EddyCareRecommendationPanel({ onRun, loading }: { onRun: (input: Record<string, unknown>) => void; loading: boolean }) {
  return <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); onRun({ timeframe: new FormData(event.currentTarget).get("timeframe") }); }}><Select name="timeframe" defaultValue="this week"><option>today</option><option>this week</option><option>general</option></Select><EddyButton type="submit" variant="secondary" disabled={loading}>Review care</EddyButton></form>;
}
