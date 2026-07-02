import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { publicAquariumPath } from "@/domains/public/public-utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Public QR record · Fluxpoint", robots: { index: false, follow: false } };

export default async function PublicQrLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const qr = await prisma.qrCode.findUnique({
    where: { publicCode: code },
    include: { collection: { include: { publicProfile: true } } }
  });
  if (!qr) notFound();
  if (!qr.collection.publicProfile?.isPublicEnabled || !qr.collection.publicProfile.showQrLandingPages) notFound();
  const item = await prisma.aquariumItem.findFirst({
    where: { id: qr.entityId, collectionId: qr.collectionId, publicProfile: { isPublished: true } },
    include: { publicProfile: true, speciesDefinition: true, speciesVariant: true, equipmentProfile: true, aquarium: { include: { publicProfile: true } } }
  });
  if (!item?.aquarium?.publicProfile?.isPublished) notFound();
  const aquariumUrl = publicAquariumPath(qr.collection.publicProfile.publicSlug, item.aquarium.publicProfile.publicSlug);
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f3e8] p-5 text-[#07373b]">
      <section className="w-full max-w-xl rounded-3xl border border-[#bfd6d7] bg-white p-6 shadow-[0_20px_60px_rgba(6,54,57,0.12)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#5d8a5f]">Fluxpoint public QR</p>
        <h1 className="mt-3 font-display text-4xl">{item.publicProfile?.publicTitle || item.name}</h1>
        <p className="mt-2 text-[#42666a]">{[item.itemType.toLowerCase(), item.speciesVariant?.displayName || item.speciesVariant?.name, item.speciesDefinition?.scientificName].filter(Boolean).join(" · ")}</p>
        {item.publicProfile?.publicDescription || item.description ? <p className="mt-4 leading-7 text-[#365c60]">{item.publicProfile?.publicDescription || item.description}</p> : null}
        <div className="mt-5 rounded-xl bg-[#eef5f2] p-4"><div className="text-xs font-bold uppercase tracking-wide text-[#5d8a5f]">Aquarium</div><Link href={aquariumUrl} className="text-lg font-semibold text-[#237176] underline">{item.aquarium.generatedName || item.aquarium.name}</Link></div>
        <p className="mt-5 text-xs text-[#5d8a5f]">Private purchase, vendor, notes, and internal QR details are hidden.</p>
      </section>
    </main>
  );
}
