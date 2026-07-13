import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { WetlabsProject } from "@/lib/wetlabs-projects";

const statusLabels = {
  active: "Active",
  experimental: "Experimental",
  archived: "Archived",
  "coming-soon": "Coming soon"
} as const;

export function WetlabsProjectCard({ project }: { project: WetlabsProject }) {
  const content = (
    <>
      <div className="wetlabs-project-art" style={{ "--project-accent": project.accent } as React.CSSProperties}>
        <div className="wetlabs-project-orbit" aria-hidden="true" />
        {project.logo ? (
          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[1.6rem] border border-white/75 bg-[#fffdf8]/90 p-3 shadow-[0_18px_55px_rgba(13,62,73,0.14)] sm:h-28 sm:w-28">
            <Image src={project.logo} alt="" width={112} height={112} className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="relative z-10 font-display text-5xl font-semibold tracking-[-0.055em] text-[#173f3d] sm:text-6xl" aria-hidden="true">
            Axil<span className="text-[#617d57]">DB</span>
          </div>
        )}
        <span className="relative z-10 rounded-full border border-white/75 bg-[#fffdf8]/75 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#234f50]">
          {project.external ? "Independent site" : "Wetlabs project"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#577272]">{project.category}</p>
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em] text-[#153f46] sm:text-[2.65rem]">{project.name}</h3>
          </div>
          {project.status ? (
            <span className="shrink-0 rounded-full border border-[#a9c5bd] bg-[#edf6f1] px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.13em] text-[#39685f]">
              {statusLabels[project.status]}
            </span>
          ) : null}
        </div>
        <p className="mt-4 max-w-xl flex-1 text-base leading-7 text-[#52696a]">{project.description}</p>
        <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#164d55]">
          Explore {project.name}
          {project.external ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {project.external ? <span className="sr-only"> (opens external site)</span> : null}
        </span>
      </div>
    </>
  );

  const className =
    "wetlabs-project-card group flex min-h-[34rem] flex-col overflow-hidden rounded-[1.75rem] border border-[#bed0ca] bg-[#fffdf8]/82 shadow-[0_24px_80px_rgba(18,63,70,0.09)] outline-none transition duration-300 hover:-translate-y-1 hover:border-[#8eaaa2] hover:shadow-[0_30px_90px_rgba(18,63,70,0.14)] focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35";

  return project.external ? (
    <a href={project.href} className={className} aria-label={`Explore ${project.name} on its external site`}>
      {content}
    </a>
  ) : (
    <Link href={project.href} className={className} aria-label={`Explore ${project.name}`}>
      {content}
    </Link>
  );
}
