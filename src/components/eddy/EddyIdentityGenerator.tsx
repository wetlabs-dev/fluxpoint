import { EddyButton } from "@/components/eddy/EddyButton";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";

export function EddyIdentityGenerator({ imageEnabled, imageUsage, onGenerateImage, onRun, loading, imageLoading }: { imageEnabled?: boolean; imageUsage?: EddyUsageStatus | null; onGenerateImage: () => void; onRun: (action: "name-ideas" | "cover-concepts", input: Record<string, unknown>) => void; loading: boolean; imageLoading: boolean }) {
  return <div className="space-y-3"><div className="flex flex-wrap gap-3"><EddyButton type="button" variant="secondary" disabled={loading} onClick={() => onRun("name-ideas", { includeSubtitles: true })}>Generate names</EddyButton><EddyButton type="button" variant="secondary" disabled={loading} onClick={() => onRun("cover-concepts", { includeImagePrompt: true })}>Create cover concepts</EddyButton>{imageEnabled ? <EddyButton type="button" variant="secondary" disabled={imageLoading || !imageUsage?.allowed} onClick={onGenerateImage}>{imageLoading ? "Generating cover…" : "Generate cover image"}</EddyButton> : null}</div>{imageEnabled ? <EddyUsageNote usage={imageUsage} compact /> : null}</div>;
}
