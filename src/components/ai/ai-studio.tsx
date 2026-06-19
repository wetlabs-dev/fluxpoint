import { Sparkles } from "lucide-react";
import { generateAiCoverImage, selectAiSuggestion } from "@/domains/aquariums/actions";
import { aiProviderStatus, generateCareAdvice, generateCoverCardConcepts, generateTankNames, generateTroubleshootingQuestions, summarizeAquariumStatus } from "@/domains/ai/ai-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { coverGradient } from "@/lib/design/cover-card";

const fallbackCareAdvice = { title: "Eddy note", summary: "AI advice is unavailable right now. Existing tank records are still safe.", checklist: ["Check recent readings.", "Review open care tasks.", "Log any visible livestock or equipment changes."] };
const fallbackTroubleshooting = { title: "Troubleshooting questions", questions: ["What changed most recently?", "Are latest water parameters inside the normal range?", "Is any equipment behaving differently?"] };
const fallbackStatusSummary = { title: "Aquarium status", summary: "AI summary is unavailable right now.", signals: ["manual review"] };

type AiStudioProps = {
  aquarium: {
    id: string;
    collectionId: string;
    name: string;
    coverImageUrl: string | null;
    tankType: string;
    volumeGallons: number | null;
    profile: { substrate: string | null; lightingType: string | null; notes: string | null; waterSource?: string | null } | null;
    items: { itemType: string; name: string }[];
    husbandrySummaries?: string[];
    readings?: { parameter: string; value: number; unit: string }[];
    events?: { eventType: string; title: string; summary: string | null }[];
  };
};

export async function AiStudio({ aquarium }: AiStudioProps) {
  const status = aiProviderStatus();
  const aiInput = {
    collectionId: aquarium.collectionId,
    aquariumId: aquarium.id,
    name: aquarium.name,
    volumeGallons: aquarium.volumeGallons,
    tankType: aquarium.tankType,
    stocking: aquarium.items.filter((item) => ["FISH", "INVERT"].includes(item.itemType)).map((item) => item.name),
    plants: aquarium.items.filter((item) => item.itemType === "PLANT").map((item) => item.name),
    husbandrySummaries: aquarium.husbandrySummaries ?? [],
    substrate: aquarium.profile?.substrate,
    lighting: aquarium.profile?.lightingType,
    vibeNotes: aquarium.profile?.notes,
    latestParameters: aquarium.readings?.slice(0, 8),
    recentEvents: aquarium.events?.slice(0, 6)
  };
  const [names, concepts, careAdvice, troubleshooting, statusSummary] = await Promise.all([
    generateTankNames(aiInput).catch(() => []),
    generateCoverCardConcepts(aiInput).catch(() => []),
    generateCareAdvice(aiInput).catch(() => fallbackCareAdvice),
    generateTroubleshootingQuestions(aiInput).catch(() => fallbackTroubleshooting),
    summarizeAquariumStatus(aiInput).catch(() => fallbackStatusSummary)
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-water" aria-hidden="true" />
          Eddy Studio
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Eddy suggestions are generated through the {status.provider} provider and recorded in the AI request log.
          {status.fallbackActive ? " The configured provider is unavailable, so Fluxpoint is using the mock fallback." : ""}
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Eddy name ideas</h3>
            <Button type="button" variant="secondary">Ask Eddy</Button>
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
            <h3 className="font-semibold">Eddy cover-card concepts</h3>
            <form action={generateAiCoverImage}>
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <Button type="submit" variant="secondary">Ask Eddy</Button>
            </form>
          </div>
          {aquarium.coverImageUrl ? (
            <div className="overflow-hidden rounded-md border border-border bg-background/45">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={aquarium.coverImageUrl} alt={`${aquarium.name} AI cover`} className="aspect-video w-full object-cover" />
            </div>
          ) : null}
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
            <h3 className="font-semibold">Eddy's advice</h3>
            <Button type="button" variant="secondary">Ask Eddy</Button>
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
