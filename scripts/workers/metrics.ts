import { runWorker } from "./lib";

runWorker({
  name: "metrics",
  enabledEnv: "ENABLE_METRICS_WORKER"
});
