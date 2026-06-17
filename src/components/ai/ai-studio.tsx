import { Sparkles } from "lucide-react";
import { selectAiSuggestion } from "@/domains/aquariums/actions";
import { generateCoverCardConcepts, generateTankNames } from "@/domains/ai/ai-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { coverGradient } from "@/lib/design/cover-card";

type AiStudioProps = {
  aquarium: {
    id: string;
    name: string;
    tankType: string;
    volumeGallons: number | null;
    profile: { substrate: string | null; lightingType: string | null; notes: string | null } | null;
    items: { itemType: string; name: string }[];
  };
};

export async function AiStudio({ aquarium }: AiStudioProps) {
  const names = await generateTankNames({
    name: aquarium.name,
    volumeGallons: aquarium.volumeGallons,
    tankType: aquarium.tankType,
    stocking: aquarium.items.filter((item) => ["FISH", "INVERT"].includes(item.itemType)).map((item) => item.name),
    plants: aquarium.items.filter((item) => item.itemType === "PLANT").map((item) => item.name),
    substrate: aquarium.profile?.substrate,
    lighting: aquarium.profile?.lightingType,
    vibeNotes: aquarium.profile?.notes
  });
  const concepts = await generateCoverCardConcepts({ name: aquarium.name, tankType: aquarium.tankType });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-water" aria-hidden="true" />
          AI Studio
        </CardTitle>
        <p className="text-sm text-muted-foreground">Current Keeper mock suggestions are stored through the same boundary future AI providers will use.</p>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Generate name ideas</h3>
            <Button type="button" variant="secondary">Generate</Button>
          </div>
          {names.map((idea) => (
            <form action={selectAiSuggestion} key={idea.name} className="rounded-md border border-border bg-background/45 p-3">
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <input type="hidden" name="suggestionType" value="TANK_NAME" />
              <input type="hidden" name="value" value={idea.name} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-2xl font-normal leading-none text-primary">{idea.name}</div>
                  <p className="text-sm text-muted-foreground">{idea.rationale}</p>
                </div>
                <Button type="submit" variant="ghost">Assign</Button>
              </div>
            </form>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Generate cover card concepts</h3>
            <Button type="button" variant="secondary">Generate</Button>
          </div>
          {concepts.map((concept) => (
            <form action={selectAiSuggestion} key={concept.promptText} className="rounded-md border border-border bg-background/45 p-3">
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <input type="hidden" name="suggestionType" value="COVER_CARD" />
              <input type="hidden" name="value" value={JSON.stringify(concept)} />
              <div className="mb-3 h-20 rounded-md waterline" style={{ background: coverGradient(concept) }} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-primary">{concept.mood}</div>
                  <p className="text-sm text-muted-foreground">{concept.motif}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {concept.accentIllustrations.map((accent) => (
                      <Badge key={accent}>{accent}</Badge>
                    ))}
                  </div>
                </div>
                <Button type="submit" variant="ghost">Assign</Button>
              </div>
            </form>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
