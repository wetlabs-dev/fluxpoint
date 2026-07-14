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
    text: "Understand the work before asking software to act.",
    Icon: CircleDot
  },
  {
    number: "02",
    title: "Keep complexity legible",
    text: "Show relationships clearly, including the messy parts.",
    Icon: Layers3
  },
  {
    number: "03",
    title: "Preserve the history",
    text: "Keep changes, decisions, and uncertainty easy to trace.",
    Icon: History
  },
  {
    number: "04",
    title: "Reward long use",
    text: "Make the tool more helpful as records accumulate.",
    Icon: Sprout
  }
];

const traits = [
  ["Attentive", "Start with what people actually notice, measure, and care for."],
  ["Legible", "Keep context visible so records can be trusted later."],
  ["Durable", "Make software that remains useful as collections and questions change."]
] as const;

const videoTopics = ["Development logs", "Design decisions", "Project walkthroughs"];

const externalLinkClass =
  "underline decoration-[#8cb1a8] underline-offset-4 transition hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30";

export function WetlabsSplashPage() {
  return (
    <LightOnlyMarketingShell>
      <main className={`${wetlabsTypographyClassName} wetlabs-page min-h-screen overflow-hidden text-[#173f45]`}>
        <header className="sticky top-0 z-40 border-b border-[#b8cec7]/70 bg-[#f8f6ef]/[0.9] backdrop-blur-md">
          <div className="mx-auto flex min-h-14 max-w-[90rem] items-center justify-between gap-2 px-4 sm:px-6 lg:px-10">
            <Link href="/" className="group flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg pr-1 outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30" aria-label="Wetlabs home">
              <Image src="/wetlabs/brand/wetlabs-embossed.png" alt="Wetlabs" width={4639} height={1239} priority className="h-auto w-[6.7rem] transition-transform duration-300 group-hover:-rotate-1 sm:w-[7.7rem]" />
            </Link>
            <nav aria-label="Public navigation" className="flex items-center gap-0.5 text-[0.82rem] text-[#355a5c] sm:gap-1 sm:text-sm">
              <a href="#projects" className="hidden min-h-10 items-center rounded-lg px-2 transition hover:bg-white/65 hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 sm:inline-flex sm:px-3">
                Projects
              </a>
              <a href="#philosophy" className="hidden min-h-10 items-center rounded-lg px-3 transition hover:bg-white/65 hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 md:inline-flex">
                Philosophy
              </a>
              <a href={wetlabsLinks.youtube} target="_blank" rel="noopener noreferrer" className="hidden min-h-10 items-center rounded-lg px-3 transition hover:bg-white/65 hover:text-[#153f46] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 lg:inline-flex">
                YouTube<span className="sr-only"> (opens external site)</span>
              </a>
              <a href={wetlabsLinks.axildb} className="wetlabs-ui inline-flex min-h-10 items-center rounded-lg border border-[#93aca4] bg-[#fffdf8]/72 px-2.5 text-[0.82rem] text-[#174c54] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30 sm:px-3 sm:text-sm">
                AxilDB
              </a>
              <Link href={wetlabsLinks.fluxpoint} className="wetlabs-ui inline-flex min-h-10 items-center rounded-lg bg-[#174c54] px-2.5 text-[0.82rem] text-white transition hover:bg-[#103d44] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35 sm:px-3 sm:text-sm">
                Fluxpoint
              </Link>
            </nav>
          </div>
        </header>

        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-[90rem] items-center gap-12 px-5 pb-48 pt-12 sm:px-8 sm:pb-72 sm:pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:px-10 lg:pb-80 lg:pt-20">
            <div className="relative z-10 max-w-4xl">
              <Image src="/wetlabs/brand/wethands-embossed.png" alt="wet hands, quiet mind" width={1720} height={240} priority className="h-auto w-[15.5rem] sm:w-[18rem]" />
              <h1 className="wetlabs-display wetlabs-display-hero mt-4 text-[#153f46]">
                <span className="block">Tools for things</span>
                <span className="block">that grow, drift,</span>
                <span className="block">and change.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#506a6b] sm:text-xl sm:leading-9">
                Wetlabs makes practical tools for people who care for collections, aquariums, plants, and other living records. They help keep careful notes, preserve context, and understand change over time.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="#projects" className="wetlabs-ui inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#174c54] px-5 text-[0.95rem] text-white shadow-[0_14px_35px_rgba(23,76,84,0.18)] transition hover:-translate-y-0.5 hover:bg-[#103d44] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35">
                  Browse the projects
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href="#philosophy" className="wetlabs-ui inline-flex min-h-12 items-center justify-center rounded-xl border border-[#9eb8b1] bg-[#fffdf8]/72 px-5 text-[0.95rem] text-[#174c54] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                  Read the philosophy
                </a>
              </div>
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-[29rem] items-center justify-center lg:justify-self-end">
              <Image
                src="/wetlabs/brand/wetlabs-stacked-embossed.png"
                alt="Wetlabs"
                width={3278}
                height={2103}
                priority
                className="h-auto w-full max-w-[20rem] sm:max-w-[23rem] lg:max-w-[27rem]"
              />
            </div>
          </div>
          <div className="wetlabs-wave-stack" aria-hidden="true">
            <svg className="wetlabs-wave-svg" viewBox="0 0 1600 280" preserveAspectRatio="none" focusable="false">
              <g className="wetlabs-wave-layer wetlabs-wave-green">
                <path d="M-180 38 C24 24 166 44 340 34 C526 23 690 15 878 25 C1073 36 1212 19 1406 31 C1546 40 1652 53 1780 42 L1780 280 L-180 280 Z" />
              </g>
              <g className="wetlabs-wave-layer wetlabs-wave-teal">
                <path d="M-180 72 C20 56 142 78 326 67 C524 55 658 43 840 56 C1024 69 1191 49 1378 61 C1548 72 1654 91 1780 78 L1780 280 L-180 280 Z" />
              </g>
              <g className="wetlabs-wave-layer wetlabs-wave-blue">
                <path d="M-180 122 C-18 108 136 125 302 116 C478 106 623 95 808 103 C1000 111 1152 94 1334 104 C1516 114 1637 136 1780 123 L1780 280 L-180 280 Z" />
              </g>
              <g className="wetlabs-wave-layer wetlabs-wave-pale">
                <path d="M-180 184 C-5 173 132 188 294 181 C494 172 645 157 828 171 C1022 186 1184 166 1370 175 C1538 183 1653 196 1780 187 L1780 280 L-180 280 Z" />
              </g>
              <g className="wetlabs-wave-layer wetlabs-wave-mist">
                <path d="M-260 207 C-18 199 146 224 350 211 C548 198 718 225 916 211 C1106 197 1288 218 1474 209 C1630 202 1748 211 1860 221 L1860 324 L-260 324 Z" />
              </g>
            </svg>
          </div>
        </section>

        <section id="projects" className="wetlabs-section scroll-mt-20 border-b border-[#b8cec7]/75 bg-[#f2f7f3] px-5 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[90rem]">
            <div className="grid gap-5 lg:grid-cols-[0.55fr_1.45fr] lg:items-end">
              <p className="wetlabs-eyebrow">The project shelf</p>
              <div>
                <h2 className="wetlabs-display wetlabs-display-section max-w-4xl text-[#153f46]">Separate tools, held together by a way of working.</h2>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-[#52696a]">
                  Fluxpoint and AxilDB solve different problems, but they share the same habits: careful records, visible context, light assistance, and usefulness that should still hold up years from now.
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
                Wetlabs projects begin as real tools built for real care work: tracking aquariums, organizing plants, and keeping notes that survive the week. When a tool keeps proving useful, it gets refined, documented, and shared.
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
                  <h3 className="wetlabs-display mt-7 text-[1.6rem] leading-[1.08] tracking-normal text-[#153f46]">{title}</h3>
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
                The channel will collect development logs, design notes, project walkthroughs, and the small decisions that shape each tool over time.
              </p>
              <a href={wetlabsLinks.youtube} target="_blank" rel="noopener noreferrer" className="wetlabs-ui mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#8eadab] bg-[#fffdf8]/80 px-5 text-[0.95rem] text-[#174c54] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
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
                  <span className="wetlabs-display mt-3 block max-w-lg text-[clamp(1.8rem,3.4vw,3rem)] leading-[1.05] tracking-normal text-[#174c54]">Development logs and walkthroughs</span>
                  <span className="mt-4 block max-w-xl text-base leading-7 text-[#526b69]">As videos are published, this will become a record of design choices, project progress, and what changes after real use.</span>
                </div>
                <span className="wetlabs-ui mt-6 inline-flex items-center gap-2 text-[0.95rem] text-[#174c54]">Visit the channel <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
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
                Software here grows through use. Features earn their place by making records clearer, revealing what changed, and staying understandable after revision.
              </p>
              <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {["Built from use", "Features earn their place", "Revision over perfection", "Clear about uncertainty"].map((item) => (
                  <li key={item} className="wetlabs-ui flex items-center gap-3 border-t border-white/[0.16] pt-4 text-[0.95rem] text-white/90">
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
              <h2 className="wetlabs-display mt-4 text-[clamp(2rem,4vw,3.5rem)] leading-none tracking-normal text-[#173f45]">Help keep the work independent.</h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5e6d69]">GitHub stars help more people find the projects. Ko-fi support helps protect the time to build, document, and maintain them without making the work louder than it needs to be.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-self-start">
              <a href={wetlabsLinks.kofi} target="_blank" rel="noopener noreferrer" className="wetlabs-ui inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#174c54] px-5 text-[0.95rem] text-white transition hover:bg-[#103d44] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35">
                <Coffee className="h-4 w-4" aria-hidden="true" /> Support on Ko-fi <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href={wetlabsLinks.github} target="_blank" rel="noopener noreferrer" className="wetlabs-ui inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#a9957b] bg-[#fffdf8]/70 px-5 text-[0.95rem] text-[#174c54] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                <Github className="h-4 w-4" aria-hidden="true" /> GitHub <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-[#b8cec7]/75 bg-[#f3f3ea]/70 px-5 py-12 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-[#2f8e89]/30">
                <Image src="/wetlabs/brand/wetlabs-embossed.png" alt="Wetlabs" width={4639} height={1239} className="h-auto w-40" />
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
              <p className="text-sm leading-6 text-[#516c6d]">Made slowly, improved continuously, and shared as it becomes useful.</p>
            </div>
          </div>
        </footer>
      </main>
    </LightOnlyMarketingShell>
  );
}
