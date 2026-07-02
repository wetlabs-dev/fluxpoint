import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicAquariumView } from "@/components/public/PublicAquariumView";
import { loadPublicAquarium } from "@/domains/public/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ publicSlug: string; aquariumSlug: string }> }): Promise<Metadata> {
  const { publicSlug, aquariumSlug } = await params;
  const data = await loadPublicAquarium(publicSlug, aquariumSlug);
  if (!data?.aquarium) return { title: "Private aquarium · Fluxpoint", robots: { index: false, follow: false } };
  return { title: `${data.aquarium.title} · ${data.collection.displayName}`, description: data.aquarium.description || data.aquarium.subtitle || undefined, robots: { index: data.collection.settings.allowSearchIndexing, follow: data.collection.settings.allowSearchIndexing }, openGraph: { title: data.aquarium.title, description: data.aquarium.description || data.aquarium.subtitle || undefined, images: data.aquarium.cover?.url ? [{ url: data.aquarium.cover.url }] : undefined } };
}

export default async function PublicAquariumPage({ params }: { params: Promise<{ publicSlug: string; aquariumSlug: string }> }) {
  const { publicSlug, aquariumSlug } = await params;
  const data = await loadPublicAquarium(publicSlug, aquariumSlug);
  if (!data?.aquarium) notFound();
  return <PublicAquariumView collection={data.collection} aquarium={data.aquarium} />;
}
