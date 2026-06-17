import { featureCards } from "@/components/marketing/marketing-data";

export function FluxpointFeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#5e794e]">Built for living water</p>
        <h2 className="font-display text-4xl font-normal leading-none text-[#103f48]">The aquarium record, the care log, and the next task in one place.</h2>
        <p className="mt-3 leading-7 text-[#587073]">
          Fluxpoint keeps the everyday care surface calm while preserving the detail serious aquarists need later.
        </p>
      </div>
      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {featureCards.map(({ group, title, text, Icon }) => (
          <article key={title} className="flex min-h-[230px] flex-col rounded-lg border border-[#cfded5] bg-white/68 p-5 shadow-[0_8px_30px_rgba(11,43,49,0.06)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Icon className="h-6 w-6 shrink-0 text-[#23707b]" aria-hidden="true" />
              <span className="rounded-md border border-[#d4ded2] bg-[#fffdf7] px-2.5 py-1 text-xs font-bold text-[#5e794e]">{group}</span>
            </div>
            <h3 className="font-display text-2xl font-normal leading-none text-[#103f48]">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#587073]">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
