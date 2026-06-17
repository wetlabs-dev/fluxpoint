import { Activity, Bot, CalendarCheck, Gauge, PackageSearch, Sparkles, Wrench, Waves } from "lucide-react";
import { siteConfig } from "@/lib/config/site";

const features = [
  {
    title: "Aquarium records and stocking",
    text: "Track tank metadata, inhabitants, plants, botanicals, hardscape, and storage items through one reusable instance model.",
    icon: PackageSearch
  },
  {
    title: "Equipment and maintenance",
    text: "Keep lights, filters, heaters, pumps, sensors, and controllers visible with maintenance-ready profile data.",
    icon: Wrench
  },
  {
    title: "Metrics and sensors",
    text: "Prepare for manual readings, sensor devices, channels, and Prometheus-backed metrics without requiring live infrastructure on day one.",
    icon: Gauge
  },
  {
    title: "Workflows",
    text: "Build repeatable routines for weekly care, quarantine, medication courses, cycling, vacations, and acclimation.",
    icon: CalendarCheck
  }
];

const tankCards = [
  { name: "Driftlake", meta: "22 gal · freshwater", reading: "75.8 F", color: "from-teal-950 via-emerald-700 to-amber-300" },
  { name: "Mossglow", meta: "9 gal · planted nano", reading: "pH 6.9", color: "from-emerald-950 via-lime-700 to-yellow-200" },
  { name: "Duskbrook", meta: "29 gal · creek bend", reading: "NO3 12 ppm", color: "from-slate-900 via-cyan-800 to-stone-300" }
];

export function FluxpointSplashPage() {
  return (
    <main className="min-h-screen bg-[#f7f2e8] text-[#12343a]">
      <section className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(100,154,139,0.32),transparent_34rem),radial-gradient(circle_at_88%_18%,rgba(209,180,111,0.28),transparent_28rem)]" />
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href={siteConfig.marketingUrl} className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#103f48] text-white">
              <Waves className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="text-xl font-bold">{siteConfig.siteName}</span>
          </a>
          <a className="rounded-md bg-[#103f48] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-950/20" href={siteConfig.appUrl}>
            Launch Fluxpoint
          </a>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 pb-10 pt-16 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#5e794e]">Aquarium management for living systems</p>
            <h1 className="max-w-4xl text-5xl font-bold leading-[1.02] tracking-normal text-[#103f48] sm:text-6xl lg:text-7xl">
              Cozy operations for tanks that are always changing.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#496266]">
              Track aquariums, stocking, equipment, maintenance, water parameters, workflows, and sensor-driven insights in one soft, modern dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="rounded-md bg-[#103f48] px-5 py-3 text-sm font-bold text-white shadow-xl shadow-teal-950/20" href={siteConfig.appUrl}>
                Launch Fluxpoint
              </a>
              <a className="rounded-md border border-[#abc0b4] bg-white/55 px-5 py-3 text-sm font-bold text-[#103f48]" href="#features">
                Explore features
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-white/70 bg-white/55 p-4 shadow-2xl shadow-teal-950/20 backdrop-blur">
            <div className="rounded-md bg-gradient-to-br from-[#0d3e49] via-[#4f927e] to-[#d4b871] p-5 text-white">
              <div className="mb-20 flex items-center justify-between">
                <span className="rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-bold">Live collection</span>
                <Activity className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="text-4xl font-bold">Driftlake</div>
              <p className="mt-2 text-sm text-white/80">quiet driftwood meadow · 22 gal freshwater</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["Temperature 75.8 F", "pH 6.8", "Nitrate 8 ppm"].map((metric) => (
                <div key={metric} className="rounded-md bg-[#edf1e6] p-3 text-sm font-semibold text-[#103f48]">{metric}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-lg border border-[#d4ded2] bg-white/72 p-5 shadow-lg shadow-teal-950/5">
                <feature.icon className="mb-5 h-7 w-7 text-[#23707b]" aria-hidden="true" />
                <h2 className="text-lg font-bold text-[#103f48]">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#587073]">{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="rounded-lg bg-[#123f46] p-7 text-white shadow-xl shadow-teal-950/20">
            <Sparkles className="mb-5 h-8 w-8 text-[#e2c884]" aria-hidden="true" />
            <h2 className="text-3xl font-bold">AI-generated tank names and cover cards</h2>
            <p className="mt-4 leading-7 text-white/78">
              Fluxpoint is ready for provider-backed suggestions like Driftlake, Sunstream, and Mossglow, plus visual cover-card concepts that match each tank’s stocking, plants, hardscape, lighting, and vibe.
            </p>
          </div>
          <div className="rounded-lg border border-[#d4ded2] bg-white/72 p-7">
            <Bot className="mb-5 h-8 w-8 text-[#23707b]" aria-hidden="true" />
            <h2 className="text-3xl font-bold text-[#103f48]">Current Keeper</h2>
            <p className="mt-4 leading-7 text-[#587073]">
              The care assistant boundary is designed for naming, branding, workflow ideas, stocking notes, and maintenance advice while keeping the first version mock-driven and predictable.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-3xl font-bold text-[#103f48]">Mock dashboard cards</h2>
            <p className="mt-3 leading-7 text-[#587073]">Reusable cards make the app feel like a living aquarium journal, not a spreadsheet with fins.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {tankCards.map((card) => (
              <article key={card.name} className="overflow-hidden rounded-lg border border-[#d4ded2] bg-white shadow-xl shadow-teal-950/10">
                <div className={`min-h-40 bg-gradient-to-br ${card.color} p-5 text-white`}>
                  <div className="mb-16 rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-bold w-fit">Aquarium</div>
                  <h3 className="text-3xl font-bold">{card.name}</h3>
                  <p className="mt-1 text-sm text-white/78">{card.meta}</p>
                </div>
                <div className="p-5">
                  <div className="rounded-md bg-[#edf1e6] p-3 text-sm font-bold text-[#103f48]">{card.reading}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-lg bg-[#103f48] p-7 text-white shadow-2xl shadow-teal-950/20 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-bold">Ready to tend the waterline?</h2>
            <p className="mt-2 text-white/75">Open the canonical Fluxpoint app on its dedicated subdomain.</p>
          </div>
          <a className="rounded-md bg-[#f0dfb2] px-5 py-3 text-sm font-bold text-[#103f48]" href={siteConfig.appUrl}>
            Launch Fluxpoint
          </a>
        </div>
      </section>
    </main>
  );
}
