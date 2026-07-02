import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { canViewCollection } from "@/domains/auth/permissions";
import { PublicAquariumView } from "@/components/public/PublicAquariumView";
import { loadPublicAquarium } from "@/domains/public/queries";
import { publicSlug } from "@/domains/public/public-utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Public aquarium preview · Fluxpoint", robots: { index: false, follow: false } };

export default async function PublicAquariumPreviewPage({ params }: { params: Promise<{ aquariumId: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  if (!(await canViewCollection(user.id, collection.id))) notFound();
  const { aquariumId } = await params;
  const aquarium = await prisma.aquarium.findFirst({ where: { id: aquariumId, collectionId: collection.id }, include: { publicProfile: true } });
  if (!aquarium) notFound();
  const collectionProfile = await prisma.collectionPublicProfile.upsert({
    where: { collectionId: collection.id },
    update: {},
    create: { collectionId: collection.id, isPublicEnabled: false, publicSlug: publicSlug(`${collection.name}-${collection.id.slice(-6)}`), displayName: collection.name }
  });
  const aquariumProfile = aquarium.publicProfile ?? await prisma.aquariumPublicProfile.create({ data: { collectionId: collection.id, aquariumId: aquarium.id, isPublished: false, publicSlug: publicSlug(`${aquarium.generatedName ?? aquarium.name}-${aquarium.id.slice(-6)}`) } });
  const data = await loadPublicAquarium(collectionProfile.publicSlug, aquariumProfile.publicSlug, aquarium.id);
  if (!data?.aquarium) notFound();
  return <PublicAquariumView collection={data.collection} aquarium={data.aquarium} preview />;
}
