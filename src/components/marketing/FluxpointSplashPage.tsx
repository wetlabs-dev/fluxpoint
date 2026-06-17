import { Cpu, Heart, ServerCog, Waves } from "lucide-react";
import { siteConfig } from "@/lib/config/site";
import { FluxpointAiIdentitySection } from "@/components/marketing/FluxpointAiIdentitySection";
import { FluxpointDashboardMock } from "@/components/marketing/FluxpointDashboardMock";
import { FluxpointFeatureGrid } from "@/components/marketing/FluxpointFeatureGrid";
import { FluxpointHero } from "@/components/marketing/FluxpointHero";
import { hardwareItems, operationItems, platformPrinciples, workflowSteps } from "@/components/marketing/marketing-data";

export function FluxpointSplashPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f2e8] text-[#12343a]">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,rgba(116,168,146,0.28),transparent_32rem),radial-gradient(circle_at_88%_24%,rgba(216,188,121,0.25),transparent_30rem)]" />
      <header className="sticky top-0 z-30 border-b border-[#d7e1d8]/80 bg-[#f7f2e8]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
          <a href={siteConfig.marketingUrl} className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#103f48] text-white">
              <Waves className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="truncate text-xl font-bold text-[#103f48]">Fluxpoint</span>
          </a>
          <nav className="flex shrink-0 items-center gap-2 text-sm">
            <a className="hidden rounded-md px-3 py-2 font-semibold text-[#496266] transition hover:bg-white/70 sm:inline-block" href="#features">
              Features
            </a>
            <a className="hidden rounded-md px-3 py-2 font-semibold text-[#496266] transition hover:bg-white/70 sm:inline-block" href="#workflows">
              Workflows
            </a>
            <a className="rounded-md bg-[#103f48] px-4 py-2 font-bold text-white shadow-sm transition hover:bg-[#0b3037]" href={siteConfig.appUrl}>
              Launch Fluxpoint
            </a>
          </nav>
        </div>
      </header>

      <FluxpointHero />
      <FluxpointFeatureGrid />
      <FluxpointAiIdentitySection />

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#5e794e]">Dashboard</p>
          <h2 className="text-3xl font-bold text-[#103f48]">Soft tank cards with readings that feel readable at a glance.</h2>
          <p className="mt-3 leading-7 text-[#587073]">
            Cards can show temperature, TDS, turbidity, pH, nitrate, cover-card mood, and tank identity without burying the daily signal.
          </p>
        </div>
        <FluxpointDashboardMock />
      </section>

      <section className="border-y border-[#d7e1d8]/80 bg-white/45">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#5e794e]">Operations</p>
            <h2 className="text-3xl font-bold text-[#103f48]">Built for the quiet work that keeps aquariums stable.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {operationItems.map(({ title, text, Icon }) => (
              <article key={title} className="rounded-lg border border-[#cfded5] bg-[#fffaf0]/80 p-5">
                <Icon className="mb-4 h-6 w-6 text-[#23707b]" aria-hidden="true" />
                <h3 className="text-xl font-bold text-[#103f48]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#587073]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div className="rounded-lg bg-[#123f46] p-7 text-white">
          <Cpu className="mb-5 h-8 w-8 text-[#e2c884]" aria-hidden="true" />
          <h2 className="text-3xl font-bold">Metrics and hardware, ready when the tank room is.</h2>
          <p className="mt-4 leading-7 text-white/78">
            Fluxpoint prepares for sensor projects without requiring them: manual readings now, hardware channels later, and a model that can feed future dashboards cleanly.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {hardwareItems.map((item) => (
            <div key={item} className="rounded-lg border border-[#cfded5] bg-white/72 p-4 text-sm font-bold leading-6 text-[#103f48]">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section id="workflows" className="border-y border-[#d7e1d8]/80 bg-white/45">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[#5e794e]">Workflows</p>
            <h2 className="text-3xl font-bold text-[#103f48]">Repeatable care routines without turning the app into a checklist silo.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workflowSteps.map(([title, text], index) => (
              <article key={title} className="rounded-lg border border-[#cfded5] bg-[#fffaf0]/80 p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-[#103f48] text-sm font-bold text-white">{index + 1}</div>
                <h3 className="text-xl font-bold text-[#103f48]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#587073]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-[#cfded5] bg-white/72 p-7">
            <ServerCog className="mb-5 h-8 w-8 text-[#23707b]" aria-hidden="true" />
            <h2 className="text-3xl font-bold text-[#103f48]">Self-hosted care records for living systems.</h2>
            <p className="mt-4 leading-7 text-[#587073]">
              Fluxpoint is built for aquarists who want durable records, calm operations, and room to grow from manual logs into
              sensors, QR labels, workflows, and team-friendly aquarium care.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {platformPrinciples.map((principle) => (
                <span key={principle} className="rounded-full border border-[#cfded5] bg-[#edf2e7] px-3 py-1 text-sm font-semibold text-[#103f48]">
                  {principle}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[#d8bc79]/35 bg-[#fff7df] p-7">
            <Heart className="mb-5 h-8 w-8 text-[#a96f2d]" aria-hidden="true" />
            <h2 className="text-3xl font-bold text-[#103f48]">Support development</h2>
            <p className="mt-4 leading-7 text-[#587073]">
              If Fluxpoint helps your aquarium room, a Ko-fi contribution helps cover hosting, testing, and the next round of careful features.
            </p>
            <a className="mt-6 inline-flex rounded-md bg-[#a96f2d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8b5924]" href={siteConfig.donateUrl}>
              Donate on Ko-fi
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[#cfded5] bg-white/72 p-7 text-center">
          <h2 className="text-3xl font-bold text-[#103f48]">Ready to tend the waterline?</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#587073]">
            Open the canonical Fluxpoint app on its dedicated subdomain.
          </p>
          <a className="mt-6 inline-flex rounded-md bg-[#103f48] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0b3037]" href={siteConfig.appUrl}>
            Launch Fluxpoint
          </a>
        </div>
      </section>

      <footer className="border-t border-[#d7e1d8] px-5 py-8 text-sm text-[#587073] sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#103f48]">Fluxpoint — Aquarium Management for Living Systems</p>
            <p className="text-xs">Made by Wetlabs for living water, careful records, and calm operations.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <a className="underline" href={siteConfig.appUrl}>App</a>
            <a className="underline" href={siteConfig.donateUrl}>Ko-fi</a>
            <a className="underline" href="#features">Features</a>
            <a className="underline" href="#workflows">Workflows</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
