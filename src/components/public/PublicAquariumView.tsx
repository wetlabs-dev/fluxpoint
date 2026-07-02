import Link from "next/link";
import { publicCollectionPath } from "@/domains/public/public-utils";
import { LightingSchedulePreview } from "@/components/lighting/lighting-schedule-preview";

export function PublicAquariumView({ collection, aquarium, preview = false }: { collection: any; aquarium: any; preview?: boolean }) {
  return (
    <main className="min-h-screen bg-[#f7f3e8] text-[#07373b]">
      <section className="mx-auto max-w-5xl px-5 py-8">
        {preview ? <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Preview — not public unless published.</div> : null}
        <Link href={publicCollectionPath(collection.slug)} className="text-sm font-bold text-[#237176] underline">← {collection.displayName}</Link>
        <header className="mt-4 overflow-hidden rounded-3xl border border-[#b8d4d4] bg-white shadow-[0_20px_60px_rgba(6,54,57,0.12)]">
          <div className="relative min-h-72 bg-gradient-to-br from-[#285f62] to-[#d3bf74]">{aquarium.cover ? <img src={aquarium.cover.url} alt={aquarium.cover.alt} className="absolute inset-0 h-full w-full object-cover" /> : null}<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" /><div className="relative flex min-h-72 flex-col justify-end p-6 text-white"><div className="flex flex-wrap gap-2">{aquarium.habitat.map((label: string) => <span key={label} className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur">{label}</span>)}<span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur">{aquarium.tankType.toLowerCase()}</span></div><h1 className="mt-3 font-display text-5xl">{aquarium.title}</h1>{aquarium.subtitle ? <p className="mt-2 text-lg">{aquarium.subtitle}</p> : null}</div></div>
          <div className="grid gap-3 p-5 sm:grid-cols-3"><Info label="Volume" value={aquarium.volume} /><Info label="Inhabitants" value={`${aquarium.inhabitantCount ?? aquarium.inhabitants.length}`} /><Info label="Plants" value={`${aquarium.plants.length}`} /></div>
        </header>
        {aquarium.description ? <section className="mt-6 rounded-2xl border border-[#bfd6d7] bg-white/80 p-5"><h2 className="text-2xl font-semibold">About this aquarium</h2><p className="mt-2 leading-7 text-[#365c60]">{aquarium.description}</p></section> : null}
        <PublicList title="Inhabitants" items={aquarium.inhabitants} />
        <PublicList title="Plants" items={aquarium.plants} />
        <PublicList title="Equipment and hardscape" items={aquarium.equipment} />
        {aquarium.schedules?.length ? <section className="mt-6 rounded-2xl border border-[#bfd6d7] bg-white/80 p-5"><h2 className="text-2xl font-semibold">Lighting schedules</h2><div className="mt-3 space-y-4">{aquarium.schedules.map((assignment: any) => <div key={assignment.id} className="rounded-xl bg-[#eef5f2] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{assignment.schedule.name}</strong><p className="text-sm text-[#42666a]">{assignment.fixtureName}{assignment.schedule.description ? ` · ${assignment.schedule.description}` : ""}</p></div><span className="rounded-full border border-[#bfd6d7] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#23676b]">{assignment.schedule.rampMinutes} min ramp</span></div><div className="mt-3"><LightingSchedulePreview points={assignment.schedule.points} profile={assignment.schedule.capabilityProfile} rampMinutes={assignment.schedule.rampMinutes} /></div></div>)}</div></section> : null}
        {aquarium.metrics.length ? <section className="mt-6 rounded-2xl border border-[#bfd6d7] bg-white/80 p-5"><h2 className="text-2xl font-semibold">Water profile</h2><div className="mt-3 grid gap-3 sm:grid-cols-4">{aquarium.metrics.map((metric: any) => <Info key={`${metric.parameter}-${metric.measuredAt}`} label={metric.parameter.toLowerCase()} value={`${metric.value} ${metric.unit}`} />)}</div></section> : null}
        {aquarium.timeline.length ? <section className="mt-6 rounded-2xl border border-[#bfd6d7] bg-white/80 p-5"><h2 className="text-2xl font-semibold">Timeline highlights</h2><div className="mt-3 space-y-2">{aquarium.timeline.map((event: any) => <div key={event.id} className="rounded-xl bg-[#eef5f2] p-3"><strong>{event.title}</strong>{event.summary ? <p className="text-sm text-[#42666a]">{event.summary}</p> : null}</div>)}</div></section> : null}
        <p className="mt-10 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#5d8a5f]">Powered by Fluxpoint</p>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) { return <div className="rounded-xl bg-[#eef5f2] p-3"><div className="text-xs font-bold uppercase tracking-wide text-[#5d8a5f]">{label}</div><div className="font-semibold">{value || "—"}</div></div>; }
function PublicList({ title, items }: { title: string; items: any[] }) { if (!items.length) return null; return <section className="mt-6 rounded-2xl border border-[#bfd6d7] bg-white/80 p-5"><h2 className="text-2xl font-semibold">{title}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{items.map((item) => <div key={item.id} className="rounded-xl bg-[#eef5f2] p-3"><strong>{item.name}</strong><p className="text-sm text-[#42666a]">{[item.variantName, item.scientificName, item.equipmentType, item.brand, item.model].filter(Boolean).join(" · ")}</p>{item.quantity ? <p className="text-xs font-semibold uppercase tracking-wide text-[#5d8a5f]">{item.quantity} {item.unit || "recorded"}</p> : null}{item.description ? <p className="mt-2 text-sm text-[#42666a]">{item.description}</p> : null}</div>)}</div></section>; }
