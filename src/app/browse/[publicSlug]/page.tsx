import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { serializePublicAquarium, serializePublicCollection } from "@/domains/public/public-serializers";
import { publicAquariumPath } from "@/domains/public/public-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ publicSlug: string }> }): Promise<Metadata> {
  const { publicSlug } = await params;
  const profile = await prisma.collectionPublicProfile.findUnique({ where: { publicSlug }, include: { collection: true } });
  if (!profile || !profile.isPublicEnabled) return { title: "Private Fluxpoint collection", robots: { index: false, follow: false } };
  return { title: `${profile.displayName} · Fluxpoint`, description: profile.tagline || profile.description || "Public Fluxpoint aquarium collection", robots: { index: profile.allowSearchIndexing, follow: profile.allowSearchIndexing }, openGraph: { title: profile.displayName, description: profile.tagline || profile.description || undefined } };
}

export default async function PublicCollectionPage({ params }: { params: Promise<{ publicSlug: string }> }) {
  const { publicSlug } = await params;
  const profile = await prisma.collectionPublicProfile.findUnique({
    where: { publicSlug },
    include: {
      collection: {
        include: {
          owner: { select: { name: true } },
          aquariums: {
            where: { publicProfile: { isPublished: true } },
            include: { publicProfile: true, coverMediaAsset: true, structuredLocation: { include: { parent: { include: { parent: true } } } }, items: { where: { publicProfile: { isPublished: true } }, include: { publicProfile: true, speciesDefinition: true, speciesVariant: true, equipmentProfile: true } } },
            orderBy: { name: "asc" }
          }
        }
      }
    }
  });
  if (!profile?.isPublicEnabled) notFound();
  const collection = serializePublicCollection({ ...profile.collection, publicProfile: profile });
  if (!collection) notFound();
  const tanks = profile.showTankList ? profile.collection.aquariums.map((aquarium) => serializePublicAquarium(aquarium as any, collection.settings)).filter(Boolean) : [];
  return (
    <main className="min-h-screen bg-[#f7f3e8] text-[#07373b]">
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="rounded-3xl border border-[#b8d4d4] bg-white/80 p-6 shadow-[0_20px_60px_rgba(6,54,57,0.12)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5d8a5f]">Public Fluxpoint Collection</p>
          <h1 className="mt-3 font-display text-5xl">{collection.displayName}</h1>
          {collection.tagline ? <p className="mt-3 max-w-3xl text-xl font-semibold text-[#2d6264]">{collection.tagline}</p> : null}
          {collection.description ? <p className="mt-4 max-w-3xl text-sm leading-7 text-[#365c60]">{collection.description}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">{collection.location ? <span className="rounded-full bg-[#e8f3ef] px-3 py-1 font-semibold">{collection.location}</span> : null}{collection.ownerName ? <span className="rounded-full bg-[#e8f3ef] px-3 py-1 font-semibold">Curated by {collection.ownerName}</span> : null}</div>
        </div>
        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tanks.length ? tanks.map((tank: any) => (
            <Link key={tank.id} href={publicAquariumPath(collection.slug, tank.slug)} className="overflow-hidden rounded-2xl border border-[#bfd6d7] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="relative h-44 bg-gradient-to-br from-[#285f62] to-[#d3bf74]">{tank.cover ? <img src={tank.cover.url} alt={tank.cover.alt} className="h-full w-full object-cover" /> : null}<div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" /><div className="absolute bottom-4 left-4 right-4 text-white"><h2 className="font-display text-3xl">{tank.title}</h2>{tank.subtitle ? <p className="text-sm">{tank.subtitle}</p> : null}</div></div>
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-[#23676b]">{tank.habitat.map((label: string) => <span key={label} className="rounded-full bg-[#e8f3ef] px-2 py-1">{label}</span>)}<span className="rounded-full bg-[#e8f3ef] px-2 py-1">{tank.tankType.toLowerCase()}</span></div>
                <p className="text-sm text-[#42666a]">{[tank.volume, `${tank.inhabitants.length} inhabitants`, `${tank.plants.length} plants`].filter(Boolean).join(" · ")}</p>
              </div>
            </Link>
          )) : <div className="rounded-2xl border border-dashed border-[#bfd6d7] bg-white/70 p-8 text-center text-[#42666a] md:col-span-2 xl:col-span-3">No aquariums are published in this collection yet.</div>}
        </section>
        <p className="mt-10 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#5d8a5f]">Powered by Fluxpoint</p>
      </section>
    </main>
  );
}
