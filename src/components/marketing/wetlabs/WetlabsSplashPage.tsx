import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, CircleDot, History, Layers3, Sprout } from "lucide-react";
import { LightOnlyMarketingShell } from "@/components/marketing/LightOnlyMarketingShell";
import { absoluteAppUrl } from "@/lib/config/site";
import { wetlabsProjects } from "@/lib/wetlabs-projects";
import { WetlabsProjectCard } from "./WetlabsProjectCard";

const principles = [
  {
    number: "01",
    title: "Observe before automating",
    text: "Good assistance begins with attention. The tool should help reveal the system before it tries to act on it.",
    Icon: CircleDot
  },
  {
    number: "02",
    title: "Keep complexity legible",
    text: "Structure should make relationships easier to understand without pretending that every edge is clean.",
    Icon: Layers3
  },
  {
    number: "03",
    title: "Preserve the history",
    text: "Living systems make more sense over time. Records should keep decisions, changes, and uncertainty visible.",
    Icon: History
  },
  {
    number: "04",
    title: "Reward long use",
    text: "Projects are shaped for accumulated value, data ownership, and the quiet usefulness that compounds with care.",
    Icon: Sprout
  }
];

export function WetlabsSplashPage() {
  return (
    <LightOnlyMarketingShell>
      <main className="wetlabs-page min-h-screen overflow-hidden text-[#173f45]">
        <header className="sticky top-0 z-40 border-b border-[#b8cec7]/70 bg-[#f8f6ef]/[0.88] backdrop-blur-md">
          <div className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
            <Link href="/" className="group flex min-h-11 items-center gap-2.5 rounded-lg pr-2 outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30" aria-label="Wetlabs home">
              <Image src="/wetlabs/brand/wetlabs-mark.png" alt="" width={38} height={38} priority className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-3" />
              <Image src="/wetlabs/brand/wetlabs-wordmark.png" alt="Wetlabs" width={1408} height={282} priority unoptimized className="h-auto w-[5.8rem] sm:w-[6.5rem]" />
            </Link>
            <nav aria-label="Public navigation" className="flex items-center gap-1 text-sm font-semibold text-[#476364] sm:gap-2">
              <a href="#projects" className="inline-flex min-h-11 items-center rounded-lg px-2.5 transition hover:bg-white/65 hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 sm:px-3">
                Projects
              </a>
              <a href="#philosophy" className="hidden min-h-11 items-center rounded-lg px-3 transition hover:bg-white/65 hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 sm:inline-flex">
                Philosophy
              </a>
              <Link href="/fluxpoint" className="inline-flex min-h-11 items-center rounded-lg bg-[#174c54] px-3.5 font-bold text-white transition hover:bg-[#103d44] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35 sm:px-4">
                Fluxpoint
              </Link>
            </nav>
          </div>
        </header>

        <section className="relative overflow-hidden border-b border-[#b8cec7]/75">
          <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-[90rem] items-center gap-10 px-5 pb-36 pt-16 sm:px-8 sm:pb-44 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10 lg:pb-48 lg:pt-24">
            <div className="relative z-10 max-w-3xl">
              <p className="font-serif text-lg italic tracking-[0.02em] text-[#285f68]">wet hands, quiet mind</p>
              <h1 className="mt-5 max-w-4xl font-display text-[clamp(3.35rem,8vw,7.35rem)] font-semibold leading-[0.88] tracking-[-0.065em] text-[#153f46]">
                Tools for things that grow, drift, and change.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#506a6b] sm:text-xl sm:leading-9">
                Wetlabs is an independent studio for practical tools that help people observe, organize, care for, and understand living and evolving systems.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#projects" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#174c54] px-5 text-sm font-bold text-white shadow-[0_14px_35px_rgba(23,76,84,0.2)] transition hover:-translate-y-0.5 hover:bg-[#103d44] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35">
                  Browse the projects
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href="#philosophy" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#9eb8b1] bg-[#fffdf8]/72 px-5 text-sm font-bold text-[#174c54] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                  Read the philosophy
                </a>
              </div>
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center justify-center lg:justify-self-end">
              <div className="wetlabs-brand-disc">
                <Image src="/wetlabs/brand/wetlabs-mark.png" alt="" width={256} height={256} priority className="h-full w-full" />
              </div>
              <Image
                src="/wetlabs/brand/wetlabs-wordmark.png"
                alt="Wetlabs"
                width={1408}
                height={282}
                priority
                unoptimized
                className="mt-7 h-auto w-full max-w-[34rem] drop-shadow-[0_2px_1px_rgba(21,63,70,0.16)]"
              />
              <p className="mt-2 max-w-sm text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#43666a]">Independent projects, carefully tended</p>
            </div>
          </div>
          <div className="wetlabs-wave wetlabs-wave-back" aria-hidden="true" />
          <div className="wetlabs-wave wetlabs-wave-front" aria-hidden="true" />
        </section>

        <section id="projects" className="scroll-mt-20 border-b border-[#b8cec7]/75 bg-[#f2f7f3]/65 px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-[90rem]">
            <div className="grid gap-6 lg:grid-cols-[0.62fr_1.38fr] lg:items-end">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#52776f]">The project shelf</p>
              <div>
                <h2 className="max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#153f46] sm:text-6xl lg:text-7xl">
                  Separate tools, held together by a way of working.
                </h2>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-[#52696a]">
                  Each project has its own subject and identity. They share a preference for durable records, visible context, and assistance that leaves judgment with the person doing the work.
                </p>
              </div>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {wetlabsProjects.map((project) => (
                <WetlabsProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="mx-auto grid max-w-[90rem] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#52776f]">What Wetlabs is</p>
              <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#153f46] sm:text-6xl">
                A home for practical experiments.
              </h2>
            </div>
            <div className="grid gap-8 text-lg leading-8 text-[#506a6b] sm:grid-cols-2">
              <p>
                Wetlabs is the umbrella for independently developed projects focused on living systems, collections, and the work of keeping both understandable over time.
              </p>
              <p>
                It is less a product family than a shared workshop: ideas are tested against real use, revised when the model is wrong, and kept only when they remain useful beyond the novelty of launch.
              </p>
            </div>
          </div>
        </section>

        <section id="philosophy" className="scroll-mt-20 border-y border-[#b8cec7]/75 bg-[#fffdf8]/60 px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-[90rem]">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#52776f]">Design philosophy</p>
              <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-[#153f46] sm:text-6xl">Calm systems, honest edges.</h2>
            </div>
            <div className="mt-12 grid border-t border-[#a9c1ba] md:grid-cols-2">
              {principles.map(({ number, title, text, Icon }) => (
                <article key={number} className="border-b border-[#a9c1ba] py-8 md:odd:border-r md:odd:pr-8 md:even:pl-8">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-xs font-bold tracking-[0.18em] text-[#5b7777]">{number}</span>
                    <Icon className="h-5 w-5 text-[#2f8e89]" aria-hidden="true" />
                  </div>
                  <h3 className="mt-8 font-display text-3xl font-semibold tracking-[-0.035em] text-[#153f46]">{title}</h3>
                  <p className="mt-3 max-w-xl leading-7 text-[#52696a]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="mx-auto grid max-w-[90rem] overflow-hidden rounded-[2rem] bg-[#153f46] text-white shadow-[0_30px_100px_rgba(18,63,70,0.18)] lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-white/15 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9fd5c7]">Working approach</p>
              <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.96] tracking-[-0.045em] sm:text-6xl">Built in contact with the real work.</h2>
            </div>
            <div className="p-7 sm:p-10 lg:p-14">
              <p className="max-w-2xl text-lg leading-8 text-white/[0.78]">
                Projects develop iteratively, shaped by the records people keep and the decisions they actually need to make. Data ownership, transparent behavior, and an understandable system matter more than engagement mechanics.
              </p>
              <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {["Practical before performative", "Assistive, not authoritative", "Transparent about uncertainty", "Designed to age well"].map((item) => (
                  <li key={item} className="flex items-center gap-3 border-t border-white/[0.16] pt-4 text-sm font-semibold text-white/90">
                    <span className="h-2 w-2 rounded-full bg-[#70c2ae]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <footer className="border-t border-[#b8cec7]/75 bg-[#f3f3ea]/70 px-5 py-10 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                <Image src="/wetlabs/brand/wetlabs-mark.png" alt="" width={44} height={44} className="h-11 w-11" />
                <Image src="/wetlabs/brand/wetlabs-wordmark.png" alt="Wetlabs" width={1408} height={282} unoptimized className="h-auto w-32" />
              </Link>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#5a7071]">Independent tools for living systems, collections, and curious work.</p>
            </div>
            <div className="flex flex-col gap-4 sm:items-end">
              <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#405f61]">
                <Link className="underline decoration-[#8cb1a8] underline-offset-4 hover:text-[#153f46]" href="/fluxpoint">Fluxpoint</Link>
                <a className="inline-flex items-center gap-1 underline decoration-[#8cb1a8] underline-offset-4 hover:text-[#153f46]" href="https://www.axildb.com">
                  AxilDB <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (external site)</span>
                </a>
                <a className="inline-flex items-center gap-1 underline decoration-[#8cb1a8] underline-offset-4 hover:text-[#153f46]" href={absoluteAppUrl("/dashboard")}>Open Fluxpoint <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></a>
              </nav>
              <p className="text-xs text-[#627778]">© {new Date().getFullYear()} Wetlabs. Carefully made and quietly maintained.</p>
            </div>
          </div>
        </footer>
      </main>
    </LightOnlyMarketingShell>
  );
}
