import { processPendingMediaModeration } from "../../src/domains/media/media-service";
import { runWorker } from "./lib";

if (!process.env.ENABLE_IMAGE_MODERATION_WORKER && process.env.FLUXPOINT_IMAGE_MODERATION_ENABLED === "true") {
  process.env.ENABLE_IMAGE_MODERATION_WORKER = "true";
}

runWorker({
  name: "image-moderation",
  enabledEnv: "ENABLE_IMAGE_MODERATION_WORKER",
  intervalMs: Number(process.env.FLUXPOINT_IMAGE_MODERATION_WORKER_INTERVAL_SECONDS || process.env.IMAGE_MODERATION_WORKER_INTERVAL_SECONDS || 180) * 1000,
  tick: async () => {
    const result = await processPendingMediaModeration(Number(process.env.FLUXPOINT_IMAGE_MODERATION_BATCH_SIZE || process.env.IMAGE_MODERATION_BATCH_SIZE || 10));
    console.log(`[image-moderation] considered=${result.considered} processed=${result.processed} skipped=${result.skipped}`);
    return { summary: `Image moderation considered ${result.considered}, processed ${result.processed}.`, metadata: result };
  }
});
