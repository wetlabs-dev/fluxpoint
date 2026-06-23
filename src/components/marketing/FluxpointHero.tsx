import { Droplets } from "lucide-react";
import { siteConfig } from "@/lib/config/site";
import { FluxpointLogoTile } from "@/components/brand/FluxpointLogo";

export function FluxpointHero() {
  const heroCoverStyle = {
    backgroundImage:
      "radial-gradient(circle at 18% 18%, rgba(255,255,255,0.26), transparent 14rem), radial-gradient(circle at 78% 22%, rgba(216,188,121,0.36), transparent 18rem), linear-gradient(135deg, rgba(255,255,255,0.2) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,0.14) 25%, transparent 25%), linear-gradient(135deg, #0d3e49 0%, #3f7e76 48%, #d4b871 100%)",
    backgroundSize: "auto, auto, 22px 22px, 22px 22px, auto"
  };

  return (
    <section className="border-b border-[#d7e1d8]/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.02fr] lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex rounded-md border border-[#8aa79b]/40 bg-white/60 px-3 py-1 text-sm font-semibold text-[#2f6b5f]">
            Aquarium management for living systems
          </p>
          <h1 className="font-display text-6xl font-normal leading-none text-[#103f48] sm:text-7xl lg:text-8xl">
            Fluxpoint
          </h1>
          <p className="mt-4 text-2xl font-semibold leading-8 text-[#285b61] sm:text-3xl">
            A soft, modern aquarium management system for living water.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#496266]">
            Fluxpoint helps aquarists track aquariums, stocking, plants, hardscape, equipment, maintenance,
            water parameters, workflows, sensor data, and AI-assisted tank identity from one beautiful dashboard.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="inline-flex items-center justify-center rounded-md bg-[#103f48] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-950/20 transition hover:bg-[#0b3037]" href={siteConfig.appUrl}>
              Launch Fluxpoint
            </a>
            <a className="inline-flex items-center justify-center rounded-md border border-[#abc0b4] bg-white/70 px-5 py-3 text-sm font-bold text-[#103f48] shadow-sm transition hover:bg-white" href="#features">
              Explore features
            </a>
          </div>
        </div>

        <div className="relative min-w-0 lg:min-h-[430px]">
          <div className="absolute inset-x-6 top-4 hidden h-64 rounded-full bg-[#74a892]/25 blur-3xl lg:block" />
          <div className="relative rounded-lg border border-white/70 bg-white/65 p-4 shadow-[0_24px_80px_rgba(11,43,49,0.16)] backdrop-blur">
            <div className="rounded-md p-5 text-white" style={heroCoverStyle}>
              <div className="mb-24 flex items-center justify-between gap-3">
                <span className="rounded-full border border-white/35 bg-white/20 px-3 py-1 text-xs font-bold">AI cover concept</span>
                <FluxpointLogoTile size={28} className="rounded-md border-white/70 p-0.5 opacity-90" />
              </div>
              <h2 className="font-display text-5xl font-normal leading-none">Driftlake</h2>
              <p className="mt-2 font-sans text-sm text-white/82">quiet driftwood meadow · 22 gal freshwater</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["75.8 F", "TDS 142", "pH 6.8"].map((metric) => (
                <div key={metric} className="rounded-md bg-[#edf2e7] p-3 font-mono text-sm font-bold text-[#103f48]">{metric}</div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-[#d4ded2] bg-[#fffaf0]/80 p-4">
              <div className="flex items-start gap-3">
                <Droplets className="mt-1 h-5 w-5 text-[#23707b]" aria-hidden="true" />
                <div>
                  <p className="font-bold text-[#103f48]">Name & cover studio</p>
                  <p className="mt-1 text-sm leading-6 text-[#587073]">
                    Palette, motif, stocking, plants, hardscape, and water type stay connected to the tank record.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
