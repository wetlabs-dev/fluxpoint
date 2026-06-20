import { processPendingMediaModeration } from "../../src/domains/media/media-service";
import { runWorker } from "./lib";

runWorker({
  name: "image-moderation",
  enabledEnv: "ENABLE_IMAGE_MODERATION_WORKER",
  intervalMs: Number(process.env.IMAGE_MODERATION_WORKER_INTERVAL_SECONDS || 180) * 1000,
  tick: async () => {
    const result = await processPendingMediaModeration(Number(process.env.IMAGE_MODERATION_BATCH_SIZE || 10));
    console.log(`[image-moderation] considered=${result.considered} processed=${result.processed} skipped=${result.skipped}`);
  }
});
