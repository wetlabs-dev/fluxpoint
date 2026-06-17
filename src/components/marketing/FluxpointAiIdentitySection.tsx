import { Bot, Palette, Sparkles } from "lucide-react";
import { aiNames } from "@/components/marketing/marketing-data";

export function FluxpointAiIdentitySection() {
  return (
    <section className="border-y border-[#d7e1d8]/80 bg-white/45">
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="rounded-lg bg-[#123f46] p-7 text-white shadow-[0_18px_60px_rgba(11,43,49,0.2)]">
          <Sparkles className="mb-5 h-8 w-8 text-[#e2c884]" aria-hidden="true" />
          <h2 className="font-display text-4xl font-normal leading-none">AI-generated tank identity that starts with the actual tank.</h2>
          <p className="mt-4 leading-7 text-white/78">
            Fluxpoint can help generate tank names, visual cover-card concepts, dashboard motifs, palettes, and descriptive
            identity from the inhabitants, plants, hardscape, water type, and mood already recorded on the aquarium.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {aiNames.map((name) => (
              <span key={name} className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-sm font-semibold text-white">
                <span className="font-display text-lg font-normal leading-none">{name}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <article className="rounded-lg border border-[#cfded5] bg-white/72 p-6">
            <Palette className="mb-5 h-8 w-8 text-[#23707b]" aria-hidden="true" />
            <h3 className="font-display text-3xl font-normal leading-none text-[#103f48]">Cover-card concepts</h3>
            <p className="mt-3 leading-7 text-[#587073]">
              Palettes, motifs, typography notes, accent illustrations, and prompt text are stored as structured suggestions.
            </p>
          </article>
          <article className="rounded-lg border border-[#cfded5] bg-white/72 p-6">
            <Bot className="mb-5 h-8 w-8 text-[#23707b]" aria-hidden="true" />
            <h3 className="font-display text-3xl font-normal leading-none text-[#103f48]">Current Keeper</h3>
            <p className="mt-3 leading-7 text-[#587073]">
              The assistant boundary is ready for naming, care advice, workflow ideas, and stocking notes without turning mock data into hidden automation.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
