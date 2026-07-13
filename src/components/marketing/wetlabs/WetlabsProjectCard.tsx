import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { WetlabsProject } from "@/lib/wetlabs-projects";

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
          <div className="wetlabs-display relative z-10 text-5xl tracking-[-0.05em] text-[#173f3d] sm:text-6xl" aria-hidden="true">
            Axil<span className="text-[#617d57]">DB</span>
          </div>
        )}
        {project.external ? <ArrowUpRight className="relative z-10 h-5 w-5 text-[#315d5c]" aria-hidden="true" /> : null}
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <p className="text-[0.95rem] leading-6 text-[#577272]">{project.category}</p>
        <h3 className="wetlabs-display wetlabs-display-card mt-2 text-[#153f46]">{project.name}</h3>
        <p className="mt-4 max-w-xl flex-1 text-base leading-7 text-[#52696a]">{project.description}</p>
        <span className="mt-7 inline-flex items-center gap-2 text-sm text-[#164d55]">
          Explore {project.name}
          {project.external ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {project.external ? <span className="sr-only"> (opens external site)</span> : null}
        </span>
      </div>
    </>
  );

  const className =
    "wetlabs-project-card group flex min-h-[29rem] flex-col overflow-hidden rounded-[1.5rem] border border-[#bed0ca] bg-[#fffdf8]/82 shadow-[0_20px_65px_rgba(18,63,70,0.08)] outline-none transition duration-300 hover:-translate-y-1 hover:border-[#8eaaa2] hover:shadow-[0_28px_80px_rgba(18,63,70,0.12)] focus-visible:ring-4 focus-visible:ring-[#2f8e89]/35";

  return project.external ? (
    <a href={project.href} className={className} target="_blank" rel="noopener noreferrer" aria-label={`Explore ${project.name} on its external site`}>
      {content}
    </a>
  ) : (
    <Link href={project.href} className={className} aria-label={`Explore ${project.name}`}>
      {content}
    </Link>
  );
}
