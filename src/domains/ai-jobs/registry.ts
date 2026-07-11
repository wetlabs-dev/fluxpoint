import type { AiJob } from "@prisma/client";
import { handleAquariumCoverImage } from "@/domains/ai-jobs/handlers/aquarium-cover-image";

const handlers = { AQUARIUM_COVER_IMAGE_GENERATION: handleAquariumCoverImage } as const;

export function handlerForAiJob(job: AiJob) {
  return handlers[job.jobType];
}
