import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { FluxpointLogoTile } from "@/components/brand/FluxpointLogo";
import { LightOnlyMarketingShell } from "@/components/marketing/LightOnlyMarketingShell";
import { absoluteAppUrl, siteConfig } from "@/lib/config/site";
import { publicFeatures } from "@/lib/public-features";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const marketingBase = siteConfig.marketingUrl.endsWith("/") ? siteConfig.marketingUrl : `${siteConfig.marketingUrl}/`;
  const url = new URL("features", marketingBase).toString();
  return {
    metadataBase: new URL(siteConfig.marketingUrl),
    title: `All Features — ${siteConfig.siteName}`,
    description: "Explore the public Fluxpoint feature map for aquarium records, inhabitants, species, husbandry, inventory, labels, notifications, Eddy, and operations.",
    alternates: { canonical: url },
    openGraph: {
      title: `All Features — ${siteConfig.siteName}`,
      description: "A public, product-level tour of Fluxpoint’s aquarium management features.",
      url,
      siteName: "Wetlabs",
      type: "website"
    }
  };
}

export default function FluxpointFeaturesPage() {
  return (
    <LightOnlyMarketingShell>
      <main className="min-h-screen bg-[#f7f2e8] text-[#12343a]">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_8%,rgba(116,168,146,0.28),transparent_28rem),radial-gradient(circle_at_88%_18%,rgba(216,188,121,0.24),transparent_32rem)]" />
        <header className="border-b border-[#d7e1d8]/80 bg-[#f7f2e8]/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-6 lg:px-8">
            <Link href="/fluxpoint" className="flex min-w-0 items-center gap-3">
              <FluxpointLogoTile size={40} className="rounded-md border-[#cfded5]" />
              <span className="truncate text-xl font-bold text-[#103f48]">Fluxpoint</span>
            </Link>
            <nav className="flex shrink-0 items-center gap-2 text-sm">
              <Link className="hidden rounded-md px-3 py-2 font-semibold text-[#496266] transition hover:bg-white/70 sm:inline-flex sm:items-center sm:gap-1" href="/fluxpoint">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Splash
              </Link>
              <a className="rounded-md bg-[#103f48] px-4 py-2 font-bold text-white shadow-sm transition hover:bg-[#0b3037]" href={absoluteAppUrl("/dashboard")}>
                Launch Fluxpoint
              </a>
            </nav>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="mb-4 inline-flex rounded-md border border-[#bfd5cf] bg-white/70 px-3 py-1 text-sm font-bold text-[#2d6b62]">
                Public feature map
              </p>
              <h1 className="font-display text-6xl font-normal leading-none text-[#103f48] sm:text-7xl">Everything Fluxpoint is built to keep in view.</h1>
            </div>
            <div className="rounded-lg border border-[#cfded5] bg-white/70 p-6 shadow-[0_24px_90px_rgba(18,52,58,0.10)]">
              <Sparkles className="mb-4 h-7 w-7 text-[#23707b]" aria-hidden="true" />
              <p className="text-lg leading-8 text-[#496266]">
                Fluxpoint is a calm operating system for living aquariums: tank records, livestock, physical inventory, husbandry context,
                public sharing, QR labels, alerts, and Eddy assistance without mixing private operational data into public pages.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a className="inline-flex items-center rounded-md bg-[#103f48] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0b3037]" href={absoluteAppUrl("/dashboard")}>
                  Launch Fluxpoint
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
                <Link className="inline-flex items-center rounded-md border border-[#bfd5cf] bg-white/70 px-5 py-3 text-sm font-bold text-[#103f48] transition hover:bg-white" href="/request-account">
                  Request access
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {publicFeatures.map((feature) => (
              <article key={feature.id} className="flex min-h-[20rem] flex-col rounded-lg border border-[#cfded5] bg-[#fffaf0]/82 p-6 shadow-[0_20px_70px_rgba(18,52,58,0.08)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <p className="rounded-full border border-[#d7e1d8] bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#5e794e]">
                    {feature.eyebrow}
                  </p>
                  {feature.status ? <span className="rounded-full bg-[#e6f1ee] px-3 py-1 text-xs font-bold text-[#41666a]">{feature.status}</span> : null}
                </div>
                <h2 className="font-display text-3xl font-normal leading-none text-[#103f48]">{feature.title}</h2>
                <p className="mt-3 text-base font-semibold leading-7 text-[#2d6167]">{feature.shortDescription}</p>
                <p className="mt-3 flex-1 text-sm leading-6 text-[#587073]">{feature.longDescription}</p>
                <ul className="mt-5 space-y-2">
                  {feature.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2 text-sm font-semibold text-[#103f48]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#23707b]" aria-hidden="true" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                {feature.href ? (
                  <a className="mt-5 inline-flex items-center text-sm font-bold text-[#0c4a53] underline" href={new URL(feature.href, siteConfig.appUrl).toString()}>
                    Open in app
                    <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#d7e1d8]/80 bg-white/45 px-5 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 rounded-lg border border-[#cfded5] bg-white/75 p-7 text-center shadow-[0_20px_70px_rgba(18,52,58,0.08)]">
            <h2 className="font-display text-4xl font-normal leading-none text-[#103f48]">Want the softer overview first?</h2>
            <p className="mx-auto max-w-2xl leading-7 text-[#587073]">
              Return to the splash page for the product story, or request an account if your Fluxpoint server is invite-approved.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link className="rounded-md border border-[#bfd5cf] bg-white/70 px-5 py-3 text-sm font-bold text-[#103f48] transition hover:bg-white" href="/fluxpoint">
                Back to splash
              </Link>
              <Link className="rounded-md bg-[#103f48] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0b3037]" href="/request-account">
                Request account
              </Link>
            </div>
          </div>
        </section>
      </main>
    </LightOnlyMarketingShell>
  );
}
