import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { detectImageType, isUnsafeMediaStatus, localMediaPath } from "@/domains/media/media-service";

export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json({ error: "Media file not found." }, { status: 404, headers: { "cache-control": "no-store" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const requestedPath = path.map(decodeURIComponent).join("/");
  if (!requestedPath.startsWith("uploads/") || requestedPath.includes("..") || requestedPath.includes("\\")) return notFound();

  const url = `/${requestedPath}`;
  const asset = await prisma.mediaAsset.findFirst({
    where: { OR: [{ url }, { thumbnailUrl: url }] },
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      filename: true,
      mimeType: true,
      visibility: true,
      moderationStatus: true,
      nsfwFlagged: true,
      hiddenAt: true,
      aquarium: {
        select: {
          publicProfile: { select: { isPublished: true } },
          collection: { select: { publicProfile: { select: { isPublicEnabled: true } } } }
        }
      }
    }
  });
  if (!asset || asset.hiddenAt || asset.nsfwFlagged || isUnsafeMediaStatus(asset.moderationStatus)) return notFound();
  if (asset.moderationStatus !== "APPROVED" || asset.visibility === "PRIVATE") return notFound();

  const isGloballyPublic = asset.visibility === "PUBLIC";
  const isPublishedAquariumMedia = Boolean(asset.aquarium?.publicProfile?.isPublished && asset.aquarium.collection.publicProfile?.isPublicEnabled);
  if (!isGloballyPublic && !isPublishedAquariumMedia) return notFound();

  const filePath = localMediaPath(url);
  const [file, info] = await Promise.all([readFile(filePath), stat(filePath)]).catch(() => [null, null] as const);
  if (!file || !info) return notFound();

  return new NextResponse(file, {
    headers: {
      "content-type": detectImageType(file) || asset.mimeType,
      "content-length": String(info.size),
      "content-disposition": `inline; filename="${asset.filename.replaceAll('"', "")}"`,
      "cache-control": "public, max-age=300, stale-while-revalidate=86400"
    }
  });
}
