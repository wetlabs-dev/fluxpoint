import { Sparkles } from "lucide-react";
import { selectAiSuggestion } from "@/domains/aquariums/actions";
import { generateCareAdvice, generateCoverCardConcepts, generateTankNames, generateTroubleshootingQuestions, summarizeAquariumStatus } from "@/domains/ai/ai-service";
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
    profile: { substrate: string | null; lightingType: string | null; notes: string | null; waterSource?: string | null } | null;
    items: { itemType: string; name: string }[];
    readings?: { parameter: string; value: number; unit: string }[];
    events?: { eventType: string; title: string; summary: string | null }[];
  };
};

export async function AiStudio({ aquarium }: AiStudioProps) {
  const aiInput = {
    name: aquarium.name,
    volumeGallons: aquarium.volumeGallons,
    tankType: aquarium.tankType,
    stocking: aquarium.items.filter((item) => ["FISH", "INVERT"].includes(item.itemType)).map((item) => item.name),
    plants: aquarium.items.filter((item) => item.itemType === "PLANT").map((item) => item.name),
    substrate: aquarium.profile?.substrate,
    lighting: aquarium.profile?.lightingType,
    vibeNotes: aquarium.profile?.notes,
    latestParameters: aquarium.readings?.slice(0, 8),
    recentEvents: aquarium.events?.slice(0, 6)
  };
  const names = await generateTankNames(aiInput);
  const concepts = await generateCoverCardConcepts(aiInput);
  const careAdvice = await generateCareAdvice(aiInput);
  const troubleshooting = await generateTroubleshootingQuestions(aiInput);
  const statusSummary = await summarizeAquariumStatus(aiInput);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-water" aria-hidden="true" />
          AI Studio
        </CardTitle>
        <p className="text-sm text-muted-foreground">Current Keeper mock suggestions are stored through the same boundary future AI providers will use.</p>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-3">
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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Care assistant notes</h3>
            <Button type="button" variant="secondary">Generate</Button>
          </div>
          <form action={selectAiSuggestion} className="rounded-md border border-border bg-background/45 p-3">
            <input type="hidden" name="aquariumId" value={aquarium.id} />
            <input type="hidden" name="suggestionType" value="CARE_ADVICE" />
            <input type="hidden" name="value" value={JSON.stringify(careAdvice)} />
            <div className="font-semibold text-primary">{careAdvice.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{careAdvice.summary}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {careAdvice.checklist.map((item) => <li key={item} className="rounded-md bg-muted/45 p-2">{item}</li>)}
            </ul>
            <Button className="mt-3" type="submit" variant="ghost">Save note</Button>
          </form>
          <form action={selectAiSuggestion} className="rounded-md border border-border bg-background/45 p-3">
            <input type="hidden" name="aquariumId" value={aquarium.id} />
            <input type="hidden" name="suggestionType" value="CARE_ADVICE" />
            <input type="hidden" name="value" value={JSON.stringify(statusSummary)} />
            <div className="font-semibold text-primary">{statusSummary.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{statusSummary.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {statusSummary.signals.map((signal) => <Badge key={signal}>{signal}</Badge>)}
            </div>
            <Button className="mt-3" type="submit" variant="ghost">Save summary</Button>
          </form>
          <form action={selectAiSuggestion} className="rounded-md border border-border bg-background/45 p-3">
            <input type="hidden" name="aquariumId" value={aquarium.id} />
            <input type="hidden" name="suggestionType" value="CARE_ADVICE" />
            <input type="hidden" name="value" value={JSON.stringify(troubleshooting)} />
            <div className="font-semibold text-primary">{troubleshooting.title}</div>
            <ul className="mt-3 space-y-2 text-sm">
              {troubleshooting.questions.map((question) => <li key={question} className="rounded-md bg-muted/45 p-2">{question}</li>)}
            </ul>
            <Button className="mt-3" type="submit" variant="ghost">Save questions</Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
