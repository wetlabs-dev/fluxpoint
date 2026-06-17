import { runWorker } from "./lib";

runWorker({
  name: "ai-worker",
  enabledEnv: "ENABLE_AI_WORKER"
});
