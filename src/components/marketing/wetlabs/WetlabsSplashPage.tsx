import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  CircleDot,
  Coffee,
  Github,
  History,
  Layers3,
  Sprout,
  Youtube
} from "lucide-react";
import { LightOnlyMarketingShell } from "@/components/marketing/LightOnlyMarketingShell";
import { wetlabsTypographyClassName } from "@/lib/design/typography";
import { wetlabsLinks } from "@/lib/wetlabs-links";
import { wetlabsProjects } from "@/lib/wetlabs-projects";
import { WetlabsProjectCard } from "./WetlabsProjectCard";

const principles = [
  {
    number: "01",
    title: "Observe before automating",
    text: "Reveal the system before trying to act on it.",
    Icon: CircleDot
  },
  {
    number: "02",
    title: "Keep complexity legible",
    text: "Make relationships clearer without pretending every edge is clean.",
    Icon: Layers3
  },
  {
    number: "03",
    title: "Preserve the history",
    text: "Keep decisions, changes, and uncertainty visible over time.",
    Icon: History
  },
  {
    number: "04",
    title: "Reward long use",
    text: "Build quiet usefulness that compounds with care.",
    Icon: Sprout
  }
];

const traits = [
  ["Attentive", "Starts with the way a system is actually observed and cared for."],
  ["Legible", "Keeps context and uncertainty visible instead of smoothing them away."],
  ["Durable", "Values ownership, history, and usefulness that grows over time."]
] as const;

const videoTopics = ["Build logs", "Design decisions", "Project walkthroughs"];

const externalLinkClass =
  "underline decoration-[#8cb1a8] underline-offset-4 transition hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30";

export function WetlabsSplashPage() {
  return (
    <LightOnlyMarketingShell>
      <main className={`${wetlabsTypographyClassName} wetlabs-page min-h-screen overflow-hidden text-[#173f45]`}>
        <header className="sticky top-0 z-40 border-b border-[#b8cec7]/70 bg-[#f8f6ef]/[0.9] backdrop-blur-md">
          <div className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
            <Link href="/" className="group flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg pr-1 outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30" aria-label="Wetlabs home">
              <Image src="/wetlabs/brand/wetlabs-mark.png" alt="" width={38} height={38} priority className="h-9 w-9 transition-transform duration-300 group-hover:-rotate-3" />
              <Image src="/wetlabs/brand/wetlabs-wordmark.png" alt="Wetlabs" width={1408} height={282} priority unoptimized className="hidden h-auto w-[6.5rem] sm:block" />
            </Link>
            <nav aria-label="Public navigation" className="flex items-center gap-0.5 text-sm text-[#355a5c] sm:gap-1 sm:text-[0.95rem]">
              <a href="#projects" className="inline-flex min-h-11 items-center rounded-lg px-2 transition hover:bg-white/65 hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 sm:px-3">
                Projects
              </a>
              <a href="#philosophy" className="hidden min-h-11 items-center rounded-lg px-3 transition hover:bg-white/65 hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 md:inline-flex">
                Philosophy
              </a>
              <a href={wetlabsLinks.youtube} target="_blank" rel="noopener noreferrer" className="hidden min-h-11 items-center rounded-lg px-3 transition hover:bg-white/65 hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 sm:inline-flex">
                YouTube<span className="sr-only"> (opens external site)</span>
              </a>
              <Link href={wetlabsLinks.fluxpoint} className="wetlabs-display inline-flex min-h-11 items-center rounded-lg bg-[#174c54] px-3 text-sm text-white transition hover:bg-[#103d44] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35 sm:px-4">
                Fluxpoint
              </Link>
            </nav>
          </div>
        </header>

        <section className="relative overflow-hidden border-b border-[#b8cec7]/75">
          <div className="mx-auto grid max-w-[90rem] items-center gap-12 px-5 pb-36 pt-14 sm:px-8 sm:pb-40 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-10 lg:pb-44 lg:pt-24">
            <div className="relative z-10 max-w-4xl">
              <p className="text-lg italic tracking-[0.01em] text-[#285f68]">wet hands, quiet mind</p>
              <h1 className="wetlabs-display wetlabs-display-hero mt-5 text-[#153f46]">
                <span className="block">Tools for things</span>
                <span className="block">that grow, drift,</span>
                <span className="block">and change.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#506a6b] sm:text-xl sm:leading-9">
                Wetlabs is an independent studio for practical tools that help people observe, organize, care for, and understand living and evolving systems.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#projects" className="wetlabs-display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#174c54] px-5 text-sm text-white shadow-[0_14px_35px_rgba(23,76,84,0.18)] transition hover:-translate-y-0.5 hover:bg-[#103d44] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35">
                  Browse the projects
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href="#philosophy" className="wetlabs-display inline-flex min-h-12 items-center justify-center rounded-xl border border-[#9eb8b1] bg-[#fffdf8]/72 px-5 text-sm text-[#174c54] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                  Read the philosophy
                </a>
              </div>
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-[29rem] flex-col items-center justify-center lg:justify-self-end">
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
                className="mt-6 h-auto w-full max-w-[27rem] drop-shadow-[0_2px_1px_rgba(21,63,70,0.14)]"
              />
            </div>
          </div>
          <div className="wetlabs-wave wetlabs-wave-back" aria-hidden="true" />
          <div className="wetlabs-wave wetlabs-wave-front" aria-hidden="true" />
        </section>

        <section id="projects" className="wetlabs-section scroll-mt-20 border-b border-[#b8cec7]/75 bg-[#f2f7f3] px-5 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[90rem]">
            <div className="grid gap-5 lg:grid-cols-[0.55fr_1.45fr] lg:items-end">
              <p className="wetlabs-eyebrow">The project shelf</p>
              <div>
                <h2 className="wetlabs-display wetlabs-display-section max-w-4xl text-[#153f46]">Separate tools, held together by a way of working.</h2>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-[#52696a]">
                  Each project has its own subject and identity. Both favor durable records, visible context, and assistance that leaves judgment with the person doing the work.
                </p>
              </div>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {wetlabsProjects.map((project) => (
                <WetlabsProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>

        <section className="wetlabs-section px-5 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[90rem] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="wetlabs-eyebrow">What Wetlabs is</p>
              <h2 className="wetlabs-display wetlabs-display-section mt-5 text-[#153f46]">A home for practical experiments.</h2>
            </div>
            <div>
              <p className="max-w-3xl text-xl leading-9 text-[#506a6b]">
                Wetlabs is an independent workshop for projects focused on living systems, collections, and the work of keeping both understandable over time—tested against real use, revised when the model is wrong, and kept when they remain useful.
              </p>
              <div className="mt-10 grid gap-7 border-t border-[#aec4be] pt-7 sm:grid-cols-3">
                {traits.map(([title, text]) => (
                  <article key={title}>
                    <h3 className="wetlabs-display text-lg text-[#174c54]">{title}</h3>
                    <p className="mt-2 leading-7 text-[#5a7071]">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="philosophy" className="wetlabs-section scroll-mt-20 border-y border-[#b8cec7]/75 bg-[#fffdf8]/55 px-5 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[90rem]">
            <div className="max-w-3xl">
              <p className="wetlabs-eyebrow">Design philosophy</p>
              <h2 className="wetlabs-display wetlabs-display-section mt-5 text-[#153f46]">Calm systems, honest edges.</h2>
            </div>
            <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {principles.map(({ number, title, text, Icon }) => (
                <article key={number} className="border-t border-[#a9c1ba] pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs tracking-[0.16em] text-[#5b7777]">{number}</span>
                    <Icon className="h-5 w-5 text-[#2f8e89]" aria-hidden="true" />
                  </div>
                  <h3 className="wetlabs-display mt-7 text-[1.6rem] leading-[1.08] tracking-[-0.02em] text-[#153f46]">{title}</h3>
                  <p className="mt-3 leading-7 text-[#52696a]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="youtube" className="wetlabs-section-youtube scroll-mt-20 px-5 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[90rem] gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-16">
            <div>
              <p className="wetlabs-eyebrow">Wetlabs on YouTube</p>
              <h2 className="wetlabs-display wetlabs-display-section mt-5 text-[#153f46]">The work, in motion.</h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#52696a]">
                Occasional videos about the projects, the systems behind them, and what becomes clearer when a tool meets real work.
              </p>
              <a href={wetlabsLinks.youtube} target="_blank" rel="noopener noreferrer" className="wetlabs-display mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8eadab] bg-[#fffdf8]/80 px-5 text-sm text-[#174c54] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                <Youtube className="h-4 w-4" aria-hidden="true" />
                Visit Wetlabs on YouTube
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only"> (opens external site)</span>
              </a>
            </div>
            <div>
              <a href={wetlabsLinks.youtube} target="_blank" rel="noopener noreferrer" className="wetlabs-video-placeholder group flex min-h-[22rem] flex-col justify-between rounded-[1.5rem] border border-[#a9c1ba] p-7 outline-none transition hover:border-[#789e97] focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35 sm:aspect-video sm:min-h-0 sm:p-9" aria-label="Visit the Wetlabs development log on YouTube">
                <div>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#9dbab3] bg-[#fffdf8]/75 text-[#174c54]" aria-hidden="true">
                    <Youtube className="h-7 w-7" />
                  </span>
                  <p className="wetlabs-eyebrow mt-8">Wetlabs development log</p>
                  <span className="wetlabs-display mt-3 block max-w-lg text-[clamp(1.8rem,3.4vw,3rem)] leading-[1.05] tracking-[-0.03em] text-[#174c54]">Development videos coming soon</span>
                  <span className="mt-4 block max-w-xl text-base leading-7 text-[#526b69]">Build logs and project walkthroughs will live here as the tools continue to take shape.</span>
                </div>
                <span className="wetlabs-display mt-6 inline-flex items-center gap-2 text-sm text-[#174c54]">Visit the channel <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
              </a>
              <ul className="mt-5 grid gap-3 text-sm text-[#587071] sm:grid-cols-3">
                {videoTopics.map((topic) => (
                  <li key={topic} className="border-t border-[#b7cbc5] pt-3">{topic}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="wetlabs-working-section px-5 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[90rem] overflow-hidden rounded-[2rem] bg-[#153f46] text-white shadow-[0_30px_100px_rgba(18,63,70,0.18)] lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-white/15 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
              <p className="wetlabs-eyebrow text-[#9fd5c7]">Working approach</p>
              <h2 className="wetlabs-display wetlabs-display-section mt-5 text-white">Built in contact with the real work.</h2>
            </div>
            <div className="p-7 sm:p-10 lg:p-14">
              <p className="max-w-2xl text-lg leading-8 text-white/[0.78]">
                Projects develop iteratively around the records people keep and the decisions they actually need to make. Ownership, transparent behavior, and an understandable system matter more than engagement mechanics.
              </p>
              <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {["Practical before performative", "Assistive, not authoritative", "Transparent about uncertainty", "Designed to age well"].map((item) => (
                  <li key={item} className="wetlabs-display flex items-center gap-3 border-t border-white/[0.16] pt-4 text-sm text-white/90">
                    <span className="h-2 w-2 rounded-full bg-[#70c2ae]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="wetlabs-section-compact px-5 pt-0 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[82rem] gap-8 rounded-[1.5rem] border border-[#c9baa0] bg-[#f4ead8]/75 p-7 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10 lg:px-12">
            <div>
              <p className="wetlabs-eyebrow text-[#7b6552]">Support development</p>
              <h2 className="wetlabs-display mt-4 text-[clamp(2rem,4vw,3.5rem)] leading-none tracking-[-0.03em] text-[#173f45]">Help keep the work independent.</h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5e6d69]">Follow the code on GitHub, or support the time it takes to build, document, and maintain these projects on Ko-fi.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-self-start">
              <a href={wetlabsLinks.kofi} target="_blank" rel="noopener noreferrer" className="wetlabs-display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#174c54] px-5 text-sm text-white transition hover:bg-[#103d44] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35">
                <Coffee className="h-4 w-4" aria-hidden="true" /> Support on Ko-fi <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href={wetlabsLinks.github} target="_blank" rel="noopener noreferrer" className="wetlabs-display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#a9957b] bg-[#fffdf8]/70 px-5 text-sm text-[#174c54] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                <Github className="h-4 w-4" aria-hidden="true" /> GitHub <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-[#b8cec7]/75 bg-[#f3f3ea]/70 px-5 py-12 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                <Image src="/wetlabs/brand/wetlabs-mark.png" alt="" width={44} height={44} className="h-11 w-11" />
                <Image src="/wetlabs/brand/wetlabs-wordmark.png" alt="Wetlabs" width={1408} height={282} unoptimized className="h-auto w-32" />
              </Link>
              <p className="mt-3 max-w-md text-[0.95rem] leading-6 text-[#486364]">Independent tools for living systems, collections, and curious work.</p>
            </div>
            <div className="flex flex-col gap-4 lg:items-end">
              <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-3 text-[0.95rem] text-[#31585a]">
                <a className={externalLinkClass} href={wetlabsLinks.youtube} target="_blank" rel="noopener noreferrer">YouTube<span className="sr-only"> (opens external site)</span></a>
                <a className={externalLinkClass} href={wetlabsLinks.github} target="_blank" rel="noopener noreferrer">GitHub<span className="sr-only"> (opens external site)</span></a>
                <a className={externalLinkClass} href={wetlabsLinks.kofi} target="_blank" rel="noopener noreferrer">Ko-fi<span className="sr-only"> (opens external site)</span></a>
              </nav>
              <p className="text-sm leading-6 text-[#516c6d]">© {new Date().getFullYear()} Wetlabs. Carefully made and quietly maintained.</p>
            </div>
          </div>
        </footer>
      </main>
    </LightOnlyMarketingShell>
  );
}
