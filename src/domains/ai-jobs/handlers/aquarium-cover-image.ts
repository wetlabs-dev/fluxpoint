import type { AiJob } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { executeAiCoverImageForJob } from "@/domains/ai-jobs/cover-generation";
import { aquariumCoverPayloadSchema, TerminalAiJobError } from "@/domains/ai-jobs/types";

export async function handleAquariumCoverImage(job: AiJob) {
  const payload = aquariumCoverPayloadSchema.parse(job.payload);
  const aquarium = await prisma.aquarium.findFirst({ where: { id: payload.aquariumId, collectionId: job.collectionId }, select: { id: true } });
  if (!aquarium) throw new TerminalAiJobError("AQUARIUM_NOT_FOUND", "The aquarium no longer exists.");
  const requester = await prisma.user.findUnique({ where: { id: job.userId }, select: { serverRole: true, disabledAt: true, collectionMemberships: { where: { collectionId: job.collectionId }, select: { role: true }, take: 1 } } });
  const role = requester?.serverRole === "SERVER_ADMIN" ? "COLLECTION_OWNER" : requester?.collectionMemberships[0]?.role;
  if (!requester || requester.disabledAt || !role || !["COLLECTION_OWNER", "AQUARIST"].includes(role)) throw new TerminalAiJobError("PERMISSION_REVOKED", "Access to this aquarium was revoked.");
  await prisma.aiJob.update({ where: { id: job.id }, data: { progress: 20, progressMessage: "Generating image" } });
  return executeAiCoverImageForJob(job.collectionId, job.userId, payload);
}
