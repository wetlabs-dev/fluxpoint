import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewCollection, isServerAdmin } from "@/domains/auth/permissions";
import { isUnsafeMediaStatus, localMediaPath } from "@/domains/media/media-service";

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
      collectionId: true,
      uploadedById: true,
      url: true,
      thumbnailUrl: true,
      filename: true,
      mimeType: true,
      visibility: true,
      moderationStatus: true,
      nsfwFlagged: true,
      hiddenAt: true
    }
  });
  if (!asset || asset.hiddenAt || asset.nsfwFlagged || isUnsafeMediaStatus(asset.moderationStatus)) return notFound();

  const user = await getCurrentUser();
  const approved = asset.moderationStatus === "APPROVED";
  const publicApproved = approved && asset.visibility === "PUBLIC";
  const collectionViewer = user ? await canViewCollection(user.id, asset.collectionId) : false;
  const adminViewer = user ? await isServerAdmin(user.id) : false;
  const uploaderViewer = user && asset.uploadedById === user.id;
  const allowed = publicApproved || (approved && collectionViewer) || uploaderViewer || adminViewer;
  if (!allowed) return notFound();

  const filePath = localMediaPath(url);
  const [file, info] = await Promise.all([readFile(filePath), stat(filePath)]).catch(() => [null, null] as const);
  if (!file || !info) return notFound();

  return new NextResponse(file, {
    headers: {
      "content-type": asset.mimeType,
      "content-length": String(info.size),
      "content-disposition": `inline; filename="${asset.filename.replaceAll('"', "")}"`,
      "cache-control": "no-store, max-age=0"
    }
  });
}
