import { runWorker } from "./lib";
import { processAiJobBatch } from "../../src/domains/ai-jobs/worker";

runWorker({
  name: "ai-worker",
  enabledEnv: "ENABLE_AI_WORKER",
  intervalMs: Number(process.env.AI_WORKER_INTERVAL_SECONDS || 15) * 1000,
  tick: processAiJobBatch
});
