import { EddyButton } from "@/components/eddy/EddyButton";
import { generateAiCoverImage } from "@/domains/aquariums/actions";

export function EddyIdentityGenerator({ aquariumId, imageEnabled, onRun, loading }: { aquariumId: string; imageEnabled?: boolean; onRun: (action: "name-ideas" | "cover-concepts", input: Record<string, unknown>) => void; loading: boolean }) {
  return <div className="flex flex-wrap gap-3"><EddyButton type="button" variant="secondary" disabled={loading} onClick={() => onRun("name-ideas", { includeSubtitles: true })}>Generate names</EddyButton><EddyButton type="button" variant="secondary" disabled={loading} onClick={() => onRun("cover-concepts", { includeImagePrompt: true })}>Create cover concepts</EddyButton>{imageEnabled ? <form action={generateAiCoverImage}><input type="hidden" name="aquariumId" value={aquariumId} /><EddyButton type="submit" variant="secondary">Generate cover image</EddyButton></form> : null}</div>;
}
